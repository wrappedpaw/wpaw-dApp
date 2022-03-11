<template>
	<div>
		<div class="row q-col-gutter-md justify-center buttons text-center gt-xs">
			<div class="col-3 flex">
				<q-btn @click="depositPAW" color="primary" class="fit" stack>
					<q-icon name="img:paw-deposit.svg" size="3em" />
					<div class="text-button">Deposit PAW</div>
					<q-tooltip content-class="bg-positive">Deposit some PAW for swaps</q-tooltip>
				</q-btn>
			</div>
			<div class="col-3 flex">
				<q-btn @click="askWithdrawalAmount" :disable="withdrawalDisabled" color="primary" class="fit" stack>
					<q-icon name="img:paw-withdraw.svg" size="3em" />
					<div class="text-button">Withdraw PAW</div>
					<q-tooltip content-class="bg-positive">Withdraw PAW back to your wallet</q-tooltip>
				</q-btn>
			</div>
			<div class="col-3 flex">
				<q-btn @click="swap" color="primary" class="fit" stack>
					<q-icon name="img:wpaw-swap.svg" size="3em" style="width: 100px" />
					<div class="text-button">Swap</div>
					<q-tooltip content-class="bg-positive">Swap</q-tooltip>
				</q-btn>
			</div>
			<div class="col-3 flex">
				<q-btn to="/farms" color="primary" class="fit" stack>
					<q-icon name="img:wpaw-farming.svg" size="3em" />
					<div class="text-button">Stake &amp; Farm</div>
					<q-tooltip content-class="bg-positive">Liquidity Pools Farms</q-tooltip>
				</q-btn>
			</div>
		</div>
		<div class="warnings row justify-center" v-if="warningCode !== ''">
			<div class="col-md-8 col-xs-12">
				<q-banner inline-actions rounded class="bg-primary text-secondary">
					<span v-if="warningCode == 'out-of-paw-and-wpaw'">You need to deposit more PAW!</span>
					<template v-slot:action>
						<q-btn flat label="Deposit PAW" @click="depositPAW" v-if="warningCode == 'out-of-paw-and-wpaw'" />
					</template>
				</q-banner>
			</div>
		</div>
		<div class="row justify-center">
			<div class="col-md-7 col-sm-9 col-xs-12">
				<swap-input v-if="!isOwner" :pawBalance="pawBalance" :wPawBalance="wPawBalance" />
			</div>
		</div>
		<q-dialog v-model="promptForPawDeposit" persistent>
			<q-card class="paw-deposits-dialog">
				<q-card-section>
					<div class="text-h6">PAW Deposits</div>
				</q-card-section>
				<q-card-section class="q-gutter-sm">
					<div class="row">
						<div class="col-md-9 col-xs-12">
							<p>
								If you want to swap more PAW, simply send some PAW from your
								<span class="paw-address gt-sm">{{ pawAddress }}</span> wallet to this wallet:
								<strong class="paw-address gt-sm">{{ pawWalletForDeposits }}</strong>
								<a class="lt-md paw-address" :href="pawWalletForDepositsLink">{{ pawWalletForDeposits }}</a>
							</p>
							<p>
								Don't send amounts with more than 2 decimals and make sure there is no raw.<br />
								Using "Max" link in Kalium is probably not going to work well.<br />
								If you don't follow the previous rule, your PAW will be sent back to the wallet you sent them from.
								<b>Make sure you don't withdraw from a CEX straight to this address or you may loose your PAW!</b>
							</p>
						</div>
						<div class="gt-sm col-md-3 text-right">
							<q-icon :name="pawWalletForDepositsQRCode" size="200px" />
						</div>
					</div>
				</q-card-section>
				<q-card-actions align="right">
					<q-btn
						@click="copyPawAddressForDepositsToClipboard"
						v-if="!$q.platform.is.mobile"
						color="primary"
						text-color="secondary"
						label="Copy Address"
					/>
					<q-btn color="primary" text-color="secondary" label="OK" v-close-popup />
				</q-card-actions>
			</q-card>
		</q-dialog>
		<q-dialog v-model="promptForPawWithdrawal" persistent>
			<q-card class="paw-withdrawal-dialog">
				<form @submit.prevent.stop="withdrawPAW">
					<q-card-section>
						<div class="text-h6">PAW Withdrawals</div>
					</q-card-section>
					<q-card-section class="q-gutter-sm">
						<swap-currency-input
							ref="currency-input"
							label=""
							:amount.sync="withdrawAmount"
							:balance="pawBalance"
							currency="PAW"
							editable
						/>
					</q-card-section>
					<q-card-actions align="right">
						<q-btn flat label="Cancel" color="primary" v-close-popup />
						<q-btn type="submit" color="primary" text-color="secondary" label="Withdraw" />
					</q-card-actions>
				</form>
			</q-card>
		</q-dialog>
	</div>
</template>

<script lang="ts">
import { Component, Ref, Vue } from 'vue-property-decorator'
import { namespace } from 'vuex-class'
import SwapInput from '@/components/SwapInput.vue'
import SwapCurrencyInput from '@/components/SwapCurrencyInput.vue'
import { bnToStringFilter } from '@/utils/filters'
import paw from '@/store/modules/paw'
import accounts from '@/store/modules/accounts'
import contracts from '@/store/modules/contracts'
import backend from '@/store/modules/backend'
import { WithdrawRequest } from '@/models/WithdrawRequest'
import { WPAWToken } from '../../../artifacts/typechain/WPAWToken'
import { BigNumber } from 'ethers'
import { getAddress } from '@ethersproject/address'
import QRCode from 'qrcode'
import { copyToClipboard } from 'quasar'

const accountsStore = namespace('accounts')
const backendStore = namespace('backend')
const contractsStore = namespace('contracts')

@Component({
	components: {
		SwapInput,
		SwapCurrencyInput,
	},
	filters: {
		bnToStringFilter,
	},
})
export default class ChainInfo extends Vue {
	public pawAddress = ''
	public withdrawAmount = ''
	public promptForPawDeposit = false
	public promptForPawWithdrawal = false
	public pawWalletForDepositsQRCode = ''

	@Ref('currency-input') readonly currencyInput!: SwapCurrencyInput

	@accountsStore.Getter('isUserConnected')
	isUserConnected!: boolean

	@backendStore.Getter('pawDeposited')
	pawBalance!: BigNumber

	@backendStore.Getter('pawWalletForDeposits')
	pawWalletForDeposits!: string

	@backendStore.Getter('pawWalletForDepositsLink')
	pawWalletForDepositsLink!: string

	@contractsStore.Getter('wPawBalance')
	wPawBalance!: BigNumber

	@contractsStore.Getter('wpawAddress')
	wpawAddress!: string

	static DEX_URL: string = process.env.VUE_APP_DEX_URL || ''

	get isOwner() {
		if (accounts.activeAccount && contracts.owner) {
			return getAddress(accounts.activeAccount as string) === getAddress(contracts.owner as string)
		} else {
			return false
		}
	}

	get warningCode() {
		if (this.pawBalance.eq(BigNumber.from(0)) && this.wPawBalance.eq(BigNumber.from(0))) {
			return 'out-of-paw-and-wpaw'
		} else {
			return ''
		}
	}

	get withdrawalDisabled() {
		return !this.pawBalance.gt(BigNumber.from(0))
	}

	async depositPAW() {
		this.promptForPawDeposit = true
	}

	async askWithdrawalAmount() {
		this.promptForPawWithdrawal = true
	}

	async withdrawPAW() {
		if (accounts.activeAccount) {
			try {
				if (!this.currencyInput.validate()) {
					return
				}
				await backend.withdrawPAW({
					amount: Number.parseFloat(this.withdrawAmount),
					// amount: Number.parseInt(ethers.utils.formatEther(this.pawBalance)),
					pawAddress: paw.pawAddress,
					blockchainAddress: accounts.activeAccount,
					provider: accounts.providerEthers,
				} as WithdrawRequest)
				this.promptForPawWithdrawal = false
				this.withdrawAmount = ''
				this.$emit('withdrawal')
			} catch (err) {
				console.error("Withdrawal can't be done", err)
			}
		}
	}

	swap() {
		this.$router.push('/swaps')
		/*
		if (ChainInfo.DEX_URL === 'https://app.sushi.com' || ChainInfo.DEX_URL === 'https://pancakeswap.finance') {
			openURL(`${ChainInfo.DEX_URL}/swap?inputCurrency=${this.wpawAddress}`)
		} else {
			openURL(`${ChainInfo.DEX_URL}/#/swap?inputCurrency=${this.wpawAddress}`)
		}
		*/
	}

	async reloadBalances() {
		console.debug('in reloadBalances')

		// reload data from the backend
		await backend.loadPawDeposited(this.pawAddress)

		// reload data from the smart-contract
		const provider = accounts.providerEthers
		await contracts.initContract(provider)
		const contract: WPAWToken | null = contracts.wpawContract
		if (contract && accounts.activeAccount) {
			await contracts.loadBalances({ contract, account: accounts.activeAccount })
		} else {
			this.$q.notify({
				type: 'negative',
				message: 'Unable to reload balances!',
			})
		}
	}

	async copyPawAddressForDepositsToClipboard() {
		try {
			await copyToClipboard(this.pawWalletForDeposits)
			this.$q.notify({
				type: 'positive',
				message: 'Address copied',
			})
		} catch (err) {
			this.$q.notify({
				type: 'negative',
				message: "Can't write to clipboard!",
			})
		}
	}

	async mounted() {
		console.debug('in mounted')
		await paw.init()
		this.pawAddress = paw.pawAddress
		await backend.initBackend(this.pawAddress)
		await this.reloadBalances()
		try {
			const qrcode: string = await QRCode.toDataURL(this.pawWalletForDeposits, {
				scale: 6,
				color: {
					dark: '2A2A2E',
					light: 'FBDD11',
				},
			})
			this.pawWalletForDepositsQRCode = `img:${qrcode}`
		} catch (err) {
			console.error(err)
		}
		document.addEventListener('deposit-paw', this.depositPAW)
		document.addEventListener('withdraw-paw', this.askWithdrawalAmount)
		document.addEventListener('reload-balances', this.reloadBalances)
		document.addEventListener('swap', this.swap)
	}

	async unmounted() {
		await backend.closeStreamConnection()
	}
}
</script>

<style lang="sass" scoped>
@import '@/styles/quasar.sass'

.currency-logo
	width: 20px
	heigh: 20px
	vertical-align: top

.buttons
	max-width: 700px
	margin-left: auto
	margin-right: auto
	button
		width: 90%

.text-button
	color: $secondary
	text-align: center

#balances
	margin-top: 10px

.warnings
	padding-top: 30px

@media (min-width: 900px)
	.paw-deposits-dialog
		min-width: 900px
</style>
