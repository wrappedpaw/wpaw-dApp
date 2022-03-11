<template>
	<form @submit.prevent.stop="swap">
		<div class="q-pa-md q-gutter-sm">
			<div class="column items-end">
				<div class="col">
					<q-btn to="/history" flat icon="history" label="History" color="primary" size="md">
						<q-tooltip>History: see your past transactions and claim previously rejected transactions</q-tooltip>
					</q-btn>
				</div>
			</div>
			<swap-currency-input
				ref="from"
				label="From"
				:amount.sync="amount"
				:balance="fromBalance"
				:currency="fromCurrency"
				editable
			/>
			<div id="swap-icon" class="text-center">
				<q-icon @click="switchCurrencyInputs" name="swap_vert" class="cursor-pointer arrow-down text-center" />
			</div>
			<swap-currency-input ref="to" label="To" :amount="amount" :balance="toBalance" :currency="toCurrency" />
			<div class="text-right">
				<q-btn :label="swapLabel" type="submit" :disable="!swapEnabled" color="primary" text-color="text-black" />
			</div>
		</div>
	</form>
</template>

<script lang="ts">
import { Component, Prop, Ref, Vue } from 'vue-property-decorator'
import { namespace } from 'vuex-class'
import SwapCurrencyInput from '@/components/SwapCurrencyInput.vue'
import { ethers, BigNumber } from 'ethers'
import accounts from '@/store/modules/accounts'
import paw from '@/store/modules/paw'
import backend from '@/store/modules/backend'
import contracts from '@/store/modules/contracts'
import { WPAWToken } from '../../../artifacts/typechain'
import Dialogs from '@/utils/Dialogs'
import { Network, Networks } from '@/utils/Networks'

const pawStore = namespace('paw')
const accountsStore = namespace('accounts')

@Component({
	components: {
		SwapCurrencyInput,
	},
})
export default class SwapInput extends Vue {
	@Prop({ type: Object, required: true }) pawBalance!: BigNumber
	@Prop({ type: Object, required: true }) wPawBalance!: BigNumber
	@Ref('from') readonly fromInput!: SwapCurrencyInput
	@Ref('to') readonly toInput!: SwapCurrencyInput

	fromCurrency = ''
	toCurrency = ''

	@pawStore.Getter('pawAddress')
	pawAddress!: string

	@accountsStore.Getter('activeCryptoBalance')
	cryptoBalance!: string

	amount = ''
	swapInProgress = false

	get fromBalance() {
		if (this.fromCurrency === 'PAW') {
			return this.pawBalance
		} else {
			return this.wPawBalance
		}
	}

	get toBalance() {
		if (this.toCurrency === 'PAW') {
			return this.pawBalance
		} else {
			return this.wPawBalance
		}
	}

	get swapLabel() {
		if (this.toCurrency === 'PAW') {
			return 'Unwrap'
		} else {
			return 'Wrap'
		}
	}

	get swapEnabled() {
		return (
			this.amount &&
			Number.parseFloat(this.amount) > 0 &&
			this.fromBalance.gte(ethers.utils.parseEther(this.amount)) &&
			!this.swapInProgress
		)
	}

	get expectedBlockchain(): Network {
		return new Networks().getExpectedNetworkData()
	}

	switchCurrencyInputs() {
		const tempCurrency: string = this.toCurrency
		this.toCurrency = this.fromCurrency
		this.fromCurrency = tempCurrency
		this.resetValidation()
	}

	resetValidation() {
		this.fromInput.resetValidation()
		this.toInput.resetValidation()
	}

	async swap() {
		if (!this.fromInput.validate()) {
			return
		}

		// check that the user as at sufficient crypto available for wrapping costs
		console.debug(
			`Required crypto balance: ${this.expectedBlockchain.minimumNeededForWrap} ${this.expectedBlockchain.nativeCurrency.symbol}`
		)
		if (
			this.fromCurrency === 'PAW' &&
			Number.parseFloat(this.cryptoBalance) < this.expectedBlockchain.minimumNeededForWrap
		) {
			Dialogs.showGasNeededError(Number.parseFloat(this.cryptoBalance))
			return
		} else {
			console.info(`Crypto balance is: ${this.cryptoBalance} ${this.expectedBlockchain.nativeCurrency.symbol}`)
		}

		// warn use if wrapping/unwrapping less than 100 PAW/wPAW
		if (Number.parseFloat(this.amount) <= 100) {
			const proceed = await Dialogs.showLowAmountToWrapWarning(Number.parseFloat(this.amount))
			if (!proceed) {
				return
			}
		}

		if (accounts.activeAccount && this.amount) {
			this.swapInProgress = true
			if (this.fromCurrency === 'PAW') {
				await backend.swap({
					amount: Number.parseFloat(this.amount),
					pawAddress: paw.pawAddress,
					blockchainAddress: accounts.activeAccount,
					provider: accounts.providerEthers,
				})
			} else {
				const contract: WPAWToken | null = contracts.wpawContract
				if (contract) {
					console.info(`Swap from wPAW to PAW requested for ${this.amount} PAW to ${this.pawAddress}`)
					await contracts.swap({
						amount: ethers.utils.parseEther(this.amount),
						toPawAddress: this.pawAddress,
						contract,
					})
				}
			}
			this.$emit('swap')
			this.amount = ''
			this.swapInProgress = false
		}
	}

	created() {
		this.fromCurrency = 'PAW'
		this.toCurrency = 'wPAW'
	}
}
</script>

<style lang="sass" scoped>
@import '@/styles/quasar.sass'

.arrow-down
	font-size: 32px
	text-align: center

body.body--dark #swap-icon
	color: $primary
</style>
