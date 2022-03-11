import { getModule, VuexModule, Module, Mutation, Action } from 'vuex-module-decorators'
import { namespace } from 'vuex-class'
import { BindingHelpers } from 'vuex-class/lib/bindings'
import store from '@/store'
import { WPAWToken, WPAWToken__factory } from '@artifacts/typechain'
import { ethers, BigNumber, Signature } from 'ethers'
import { SwapToPawRequest } from '@/models/SwapToPawRequest'
import { LoadBalancesFromContractRequest } from '@/models/LoadBalancesFromContractRequest'
import Dialogs from '@/utils/Dialogs'
import { SwapToWPawRequest } from '@/models/SwapToWPawRequest'
import TokensUtil from '@/utils/TokensUtil'

@Module({
	namespaced: true,
	name: 'contracts',
	store,
	dynamic: true,
})
class ContractsModule extends VuexModule {
	private _wPawToken: WPAWToken | null = null
	private _owner = ''
	private _totalSupply: BigNumber = BigNumber.from(0)
	private _wPawBalance: BigNumber = BigNumber.from(0)

	get wpawContract() {
		return this._wPawToken
	}

	get wpawAddress() {
		return this._wPawToken ? this._wPawToken.address : ''
	}

	get owner() {
		return this._owner
	}

	get totalSupply() {
		return this._totalSupply
	}

	get wPawBalance() {
		return this._wPawBalance
	}

	@Mutation
	setWPAWToken(contract: WPAWToken) {
		this._wPawToken = contract
	}

	@Mutation
	setOwner(owner: string) {
		this._owner = owner
	}

	@Mutation
	setTotalSupply(supply: BigNumber) {
		this._totalSupply = supply
	}

	@Mutation
	setWPAWBalance(balance: BigNumber) {
		this._wPawBalance = balance
	}

	@Action
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async initContract(provider: any) {
		console.debug('in initContract')
		if (provider) {
			// do not initialize contract if this was done earlier
			if (!this._wPawToken) {
				const contract = WPAWToken__factory.connect(TokensUtil.getWPAWAddress(), provider.getSigner())
				this.context.commit('setWPAWToken', contract)

				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const totalSupplyUpdateFn = async (_from: string, _to: string, _amount: BigNumber, _event: ethers.Event) => {
					const totalSupply: BigNumber = await contract.totalSupply()
					console.log(`Total Supply: ${ethers.utils.formatEther(totalSupply)} wPAW`)
					this.setTotalSupply(totalSupply)
				}
				// update total supply on mints
				contract.on(
					contract.filters.Transfer('0x0000000000000000000000000000000000000000', null, null),
					totalSupplyUpdateFn
				)
				// update total supply on burns
				contract.on(
					contract.filters.Transfer(null, '0x0000000000000000000000000000000000000000', null),
					totalSupplyUpdateFn
				)
			}
			// at this point the contract should be initialized
			if (!this._wPawToken) {
				console.error('Smart-contract client not initialized')
				return
			}
			const contract = this._wPawToken
			const owner = await contract.owner()
			const totalSupply: BigNumber = await contract.totalSupply()
			this.setOwner(owner)
			this.setTotalSupply(totalSupply)
		}
	}

	@Action
	async loadBalances(request: LoadBalancesFromContractRequest) {
		const { contract, account } = request
		console.debug(`in loadBalances for account: ${account}`)
		const balance = await contract.balanceOf(account)
		console.info(`Balance is ${ethers.utils.formatEther(balance)} wPAW`)
		this.context.commit('setWPAWBalance', balance)
	}

	@Action
	updateWPawBalance(balance: BigNumber) {
		this.context.commit('setWPAWBalance', balance)
	}

	@Action
	async reloadWPAWBalance(request: LoadBalancesFromContractRequest) {
		const { contract, account } = request
		if (!contract || !account) {
			throw new Error(`Bad request ${JSON.stringify(request)}`)
		}
		const wpawBalance = await contract.balanceOf(account)
		console.info(`Balance ${ethers.utils.formatEther(wpawBalance)} wPAW`)
		this.context.commit('setWPAWBalance', wpawBalance)
	}

	@Action
	async mint(swapRequest: SwapToWPawRequest): Promise<string> {
		console.debug('Minting wPAW')
		const { amount, blockchainWallet, receipt, uuid, contract } = swapRequest
		const signature: Signature = ethers.utils.splitSignature(receipt)
		const txn = await contract.mintWithReceipt(blockchainWallet, amount, uuid, signature.v, signature.r, signature.s)
		await txn.wait()
		console.debug(`wPAW minted in transaction ${txn.hash}`)
		return txn.hash
	}

	@Action
	async claim(swapRequest: SwapToWPawRequest): Promise<string> {
		console.log('Claiming wPAW')
		const { amount, blockchainWallet, receipt, uuid, contract } = swapRequest
		console.debug(`Amount: ${amount}, blockchainWallet: ${blockchainWallet}, receipt: ${receipt}, uuid: ${uuid}`)
		const signature: Signature = ethers.utils.splitSignature(receipt)
		const txn = await contract.mintWithReceipt(blockchainWallet, amount, uuid, signature.v, signature.r, signature.s)
		await txn.wait()
		return txn.hash
	}

	@Action
	async swap(swapRequest: SwapToPawRequest) {
		const { amount, toPawAddress, contract } = swapRequest
		console.log(`Should swap ${ethers.utils.formatEther(amount)} wPAW to PAW for "${toPawAddress}"`)
		const txn = await contract.swapToPaw(toPawAddress, amount)
		Dialogs.startSwapToPaw(ethers.utils.formatEther(amount))
		await txn.wait()
	}
}

export default getModule(ContractsModule)
export const Contracts: BindingHelpers = namespace('contracts')
