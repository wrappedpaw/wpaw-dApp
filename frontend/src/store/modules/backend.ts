import { getModule, VuexModule, Module, Mutation, Action } from 'vuex-module-decorators'
import store from '@/store'
import Contracts from '@/store/modules/contracts'
import Accounts from '@/store/modules/accounts'
import axios, { AxiosResponse } from 'axios'
import { BigNumber, ethers, Signature } from 'ethers'
import { ClaimRequest } from '@/models/ClaimRequest'
import { SwapRequest } from '@/models/SwapRequest'
import { SwapResponse } from '@/models/SwapResponse'
import { WithdrawRequest } from '@/models/WithdrawRequest'
import { WithdrawResponse } from '@/models/WithdrawResponse'
import { ClaimResponse } from '@/models/ClaimResponse'
import Dialogs from '@/utils/Dialogs'
import { HistoryRequest } from '@/models/HistoryRequest'

@Module({
	namespaced: true,
	name: 'backend',
	store,
	dynamic: true,
})
class BackendModule extends VuexModule {
	private _online = false
	private _pawWalletForDeposits = ''
	private _pawDeposited: BigNumber = BigNumber.from(0)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _deposits: Array<any> = []
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _withdrawals: Array<any> = []
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _swaps: Array<any> = []
	private _inError = false
	private _errorMessage = ''
	private _errorLink = ''
	private _streamEventsSource: EventSource | null = null
	static BACKEND_URL: string = process.env.VUE_APP_BACKEND_URL || ''

	get online() {
		return this._online
	}

	get pawWalletForDeposits() {
		return this._pawWalletForDeposits
	}

	get pawWalletForDepositsLink() {
		return `paw:${this._pawWalletForDeposits}`
	}

	get pawDeposited() {
		return this._pawDeposited
	}

	get deposits() {
		return this._deposits
	}

	get withdrawals() {
		return this._withdrawals
	}

	get swaps() {
		return this._swaps
	}

	get inError() {
		return this._inError
	}

	get errorMessage() {
		return this._errorMessage
	}

	get errorLink() {
		return this._errorLink
	}

	@Mutation
	setOnline(online: boolean) {
		this._online = online
	}

	@Mutation
	setPawWalletForDeposits(address: string) {
		this._pawWalletForDeposits = address
	}

	@Mutation
	setPawDeposited(balance: BigNumber) {
		this._pawDeposited = balance
	}

	@Mutation
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	setDeposits(deposits: Array<any>) {
		this._deposits = deposits
	}

	@Mutation
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	setWithdrawals(withdrawals: Array<any>) {
		this._withdrawals = withdrawals
	}

	@Mutation
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	setSwaps(swaps: Array<any>) {
		this._swaps = swaps
	}

	@Mutation
	setInError(inError: boolean) {
		this._inError = inError
	}

	@Mutation
	setErrorMessage(errorMessage: string) {
		this._errorMessage = errorMessage
	}

	@Mutation
	setErrorLink(errorLink: string) {
		this._errorLink = errorLink
	}

	@Mutation
	setStreamEventsSource(eventSource: EventSource) {
		this._streamEventsSource = eventSource
	}

	@Action
	async initBackend(pawWallet: string) {
		console.log(`in initBackend`)
		try {
			const healthResponse = await axios.request({ url: `${BackendModule.BACKEND_URL}/health` })
			const healthStatus = healthResponse.data.status
			this.context.commit('setOnline', healthStatus === 'OK')

			if (!this._streamEventsSource && pawWallet) {
				console.debug(`Initiating connection to streams endpoint for ${pawWallet}`)
				/* eslint-disable @typescript-eslint/no-explicit-any */
				const eventSource: EventSource = new EventSource(`${BackendModule.BACKEND_URL}/events/${pawWallet}`)
				const withdrawalEvent = (e: any) => {
					console.debug(e)
					const { pawWallet, withdrawal, balance, transaction } = JSON.parse(e.data)
					if (transaction) {
						console.log(
							`Received paw withdrawal event. Wallet "${pawWallet}" withdrew ${withdrawal} PAW. Balance is: ${balance} PAW.`
						)
						this.context.commit('setPawDeposited', ethers.utils.parseEther(balance))
						if (Contracts.wpawContract && Accounts.activeAccount) {
							Contracts.reloadWPAWBalance({
								contract: Contracts.wpawContract,
								account: Accounts.activeAccount,
							})
						}
						Dialogs.showWithdrawalSuccess(withdrawal, transaction)
					} else {
						console.log(
							`Received paw pending withdrawal event. Wallet "${pawWallet}" withdrew ${withdrawal} PAW but this is put in a pending list`
						)
						Dialogs.showPendingWithdrawal(withdrawal)
					}
				}

				eventSource.addEventListener('paw-deposit', (e: any) => {
					console.debug(e.data)
					const { pawWallet, deposit, balance, rejected } = JSON.parse(e.data)
					if (rejected) {
						console.log(`Received ${deposit} PAW which were sent back.`)
						Dialogs.declineUserDeposit(deposit)
					} else {
						console.log(
							`Received paw deposit event. Wallet "${pawWallet}" deposited ${deposit} PAW. Balance is: ${balance} PAW.`
						)
						this.context.commit('setPawDeposited', ethers.utils.parseEther(balance))
						Dialogs.confirmUserDeposit(deposit)
					}
				})
				eventSource.addEventListener('paw-withdrawal', withdrawalEvent)
				eventSource.addEventListener('pending-withdrawal', withdrawalEvent)
				eventSource.addEventListener('swap-paw-to-wpaw', async (e: any) => {
					const { pawWallet, blockchainWallet, swapped, receipt, uuid, balance, wpawBalance } = JSON.parse(e.data)
					console.info(`Received swap PAW to wPAW event. Wallet "${pawWallet}" swapped ${swapped} PAW to WPAW.`)
					console.info(`Receipt is "${receipt}".`)
					console.info(`Balance is: ${balance} PAW, ${wpawBalance} wPAW.`)
					const signature: Signature = ethers.utils.splitSignature(receipt)
					console.log(`Signature is ${JSON.stringify(signature)}`)
					if (Contracts.wpawContract && Accounts.activeAccount) {
						try {
							const txnHash = await Contracts.mint({
								amount: ethers.utils.parseEther(swapped.toString()),
								blockchainWallet,
								receipt,
								uuid,
								contract: Contracts.wpawContract,
							})
							this.context.commit('setPawDeposited', ethers.utils.parseEther(balance))
							Contracts.reloadWPAWBalance({
								account: blockchainWallet,
								contract: Contracts.wpawContract,
							})
							const blockchainExplorerUrl = Accounts.blockExplorerUrl
							const txnLink = `${blockchainExplorerUrl}/tx/${txnHash}`
							Dialogs.confirmSwapToWPaw(swapped, txnHash, txnLink)
						} catch (err) {
							console.error(err)
							Dialogs.errorSwapToWPaw(swapped)
						}
					} else {
						console.error("Can't make the call to the smart-contract to mint")
					}
				})
				eventSource.addEventListener('swap-wpaw-to-paw', async (e: any) => {
					const { pawWallet, swapped, balance, wpawBalance } = JSON.parse(e.data)
					console.log(
						`Received swap wPAW to PAW event. Wallet "${pawWallet}" swapped ${swapped} wPAW to PAW. Balance is: ${balance} PAW, ${wpawBalance} wPAW.`
					)
					this.context.commit('setPawDeposited', ethers.utils.parseEther(balance))
					Contracts.updateWPawBalance(ethers.utils.parseEther(wpawBalance))
					Dialogs.confirmSwapToPaw(swapped)
				})
				eventSource.addEventListener('ping', () => console.debug('Ping received from the server'))
				eventSource.addEventListener('message', (e: any) => {
					console.warn('Got unexpected message')
					console.log(e)
				})
				eventSource.addEventListener('open', (e: any) => {
					console.debug('Connected to stream endpoint', e)
				})
				eventSource.addEventListener('error', (e: any) => {
					console.error(`Streams error`, e)
					if (e.readyState == EventSource.CLOSED) {
						console.log('Connection to stream endpoint was closed.')
					}
				})
				this.context.commit('setStreamEventsSource', eventSource)
			}

			const depositWalletResponse = await axios.request({ url: `${BackendModule.BACKEND_URL}/deposits/paw/wallet` })
			const depositWalletAddress = depositWalletResponse.data.address
			this.context.commit('setPawWalletForDeposits', depositWalletAddress)
		} catch (err) {
			console.error(err)
			this.context.commit('setOnline', false)
			this.context.commit(
				'setErrorMessage',
				'wPAW bridge is under maintenance. You can still use the farms while we work on this.'
			)
		}
	}

	@Action
	async closeStreamConnection() {
		if (this._streamEventsSource) {
			this._streamEventsSource.close()
			this.context.commit('setStreamEventsSource', null)
			console.debug('Closed stream conneection')
		}
	}

	@Action
	async loadPawDeposited(account: string) {
		if (account) {
			console.debug('in loadPawDeposited')
			const resp = await axios.get(`${BackendModule.BACKEND_URL}/deposits/paw/${account}`)
			const { balance } = resp.data
			this.context.commit('setPawDeposited', ethers.utils.parseEther(balance))
		} else {
			console.error("Can't load PAW deposited as address is empty")
		}
	}

	@Action
	async claimAddresses(claimRequest: ClaimRequest): Promise<ClaimResponse> {
		const { pawAddress, blockchainAddress, provider } = claimRequest
		console.info(`About to claim ${pawAddress} with ${blockchainAddress}`)
		if (provider && pawAddress && blockchainAddress) {
			try {
				const sig = await provider
					.getSigner()
					.signMessage(`I hereby claim that the PAW address "${pawAddress}" is mine`)
				// call the backend for the swap
				const resp = await axios.post(`${BackendModule.BACKEND_URL}/claim`, {
					pawAddress,
					blockchainAddress,
					sig,
				})
				this.context.commit('setInError', false)
				this.context.commit('setErrorMessage', '')
				switch (resp.status) {
					case 200:
						return ClaimResponse.Ok
					case 202:
						return ClaimResponse.AlreadyDone
					case 403:
						return ClaimResponse.Blacklisted
					default:
						return ClaimResponse.Error
				}
			} catch (err) {
				console.log(err)
				this.context.commit('setInError', true)
				if (err.response) {
					const response: AxiosResponse = err.response
					switch (response.status) {
						case 403:
							this.context.commit(
								'setErrorMessage',
								`PAW address "${pawAddress}" is blacklisted. Use another PAW address.`
							)
							break
						case 409:
							this.context.commit('setErrorMessage', response.data.message)
							break
						default:
							this.context.commit('setErrorMessage', err)
							break
					}
				} else {
					this.context.commit('setErrorMessage', err)
				}
				return ClaimResponse.Error
			}
		}
		return ClaimResponse.Error
	}

	@Action
	async swap(swapRequest: SwapRequest): Promise<SwapResponse> {
		const { amount, pawAddress, blockchainAddress, provider } = swapRequest
		console.info(`Swap from PAW to wPAW requested for ${amount} PAW`)
		if (provider && amount && blockchainAddress) {
			const sig = await provider
				.getSigner()
				.signMessage(`Swap ${amount} PAW for wPAW with PAW I deposited from my wallet "${pawAddress}"`)
			// call the backend for the swap
			try {
				await axios.post(`${BackendModule.BACKEND_URL}/swap`, {
					paw: pawAddress,
					blockchain: blockchainAddress,
					amount: amount,
					sig: sig,
				})
				Dialogs.startSwapToWPaw(amount.toString())
			} catch (err) {
				this.context.commit('setInError', true)
				if (err.response) {
					const response: AxiosResponse = err.response
					const error = response.data
					switch (response.status) {
						case 409:
							this.context.commit('setErrorMessage', error.error)
							this.context.commit('setErrorLink', error.link)
							break
						default:
							this.context.commit('setErrorMessage', err)
							this.context.commit('setErrorLink', '')
							break
					}
				} else {
					this.context.commit('setErrorMessage', err)
					this.context.commit('setErrorLink', '')
				}
				throw err
			}
		}
		return {
			message: '',
			transaction: '',
			link: '',
		}
	}

	@Action
	async withdrawPAW(withdrawRequest: WithdrawRequest): Promise<WithdrawResponse> {
		const { amount, pawAddress, blockchainAddress, provider } = withdrawRequest
		console.info(`Should withdraw ${amount} PAW to ${pawAddress}...`)
		if (provider && amount && blockchainAddress) {
			if (amount <= 0) {
				throw new Error('Invalid withdrawal amount')
			}
			const sig = await provider.getSigner().signMessage(`Withdraw ${amount} PAW to my wallet "${pawAddress}"`)
			Dialogs.startWithdrawal()
			// call the backend for the swap
			try {
				const resp = await axios.post(`${BackendModule.BACKEND_URL}/withdrawals/paw`, {
					paw: pawAddress,
					blockchain: blockchainAddress,
					amount: amount,
					sig: sig,
				})
				const result: any = resp.data
				/*
				this.context.commit('setInError', false)
				this.context.commit('setErrorMessage', '')
				this.context.commit('setErrorLink', '')
				*/
				return result
			} catch (err) {
				this.context.commit('setInError', true)
				if (err.response) {
					const response: AxiosResponse = err.response
					const error = response.data
					switch (response.status) {
						case 409:
							this.context.commit('setErrorMessage', error.error)
							this.context.commit('setErrorLink', error.link)
							break
						default:
							this.context.commit('setErrorMessage', err)
							this.context.commit('setErrorLink', '')
							break
					}
				} else {
					this.context.commit('setErrorMessage', err)
					this.context.commit('setErrorLink', '')
				}
				throw err
			}
		}
		return {
			message: '',
			transaction: '',
			link: '',
		}
	}

	@Action
	async getHistory(request: HistoryRequest) {
		const { blockchainAddress, pawAddress } = request
		console.info(`About to fetch history for ${blockchainAddress} and ${pawAddress}`)
		if (pawAddress && blockchainAddress) {
			try {
				const resp = await axios.get(`${BackendModule.BACKEND_URL}/history/${blockchainAddress}/${pawAddress}`)
				const { deposits, withdrawals } = resp.data
				const swaps = await Promise.all(
					resp.data.swaps.map(async (swap: any) => {
						if (swap.receipt && swap.uuid && Contracts.wpawContract) {
							// swap.consumed = await Contracts.wpawContract.isReceiptConsumed(swap.receipt)
							console.debug(`Blockchain address: ${blockchainAddress}`)
							console.debug(`Amount: ${swap.amount}`)
							console.debug(`UUID: ${swap.uuid}`)
							swap.consumed = await Contracts.wpawContract.isReceiptConsumed(
								blockchainAddress,
								BigNumber.from(swap.amount),
								swap.uuid
							)
						}
						return swap
					})
				)
				this.context.commit('setDeposits', deposits)
				this.context.commit('setWithdrawals', withdrawals)
				this.context.commit('setSwaps', swaps)
			} catch (err) {
				console.log(err)
				this.context.commit('setInError', true)
				if (err.response) {
					const response: AxiosResponse = err.response
					switch (response.status) {
						case 409:
							this.context.commit('setErrorMessage', response.data.message)
							break
						default:
							this.context.commit('setErrorMessage', err)
							break
					}
				} else {
					this.context.commit('setErrorMessage', err)
				}
				return ClaimResponse.Error
			}
		}
	}
}

export default getModule(BackendModule)
