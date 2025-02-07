<template>
	<q-page>
		<div class="row items-center">
			<h6 class="subtitle justify-center offset-md-1">
				<q-btn to="/" icon="arrow_back" text-color="primary" flat style="margin-top: -10px" />
				Home
			</h6>
		</div>
		<div class="q-pa-md">
			<div v-if="userHasDepositsInEndedFarms" class="row justify-center q-pb-md">
				<q-banner inline-actions rounded class="bg-primary text-secondary">
					<span>You have some deposits left in ended farms. Please withdraw!</span>
					<template v-slot:action>
						<q-btn flat label="Withdraw" @click="farmsSelected = 'ended'" />
					</template>
				</q-banner>
				<div class="col-md-1" />
			</div>
			<div class="row justify-center q-pb-md">
				<q-btn-toggle
					v-model="farmsSelected"
					rounded
					color="grey-9"
					text-color="primary"
					toggle-color="primary"
					toggle-text-color="secondary"
					:options="[
						{ label: 'Active', value: 'active', slot: 'active' },
						{ label: 'Ended', value: 'ended', slot: 'ended' },
					]"
				>
					<template v-slot:active>
						<q-tooltip>Farms still distributing rewards</q-tooltip>
					</template>
					<template v-slot:ended>
						<q-tooltip>Old farms not distributing rewards anymore!</q-tooltip>
					</template>
				</q-btn-toggle>
				<div class="col-md-1" />
			</div>
			<div class="row q-col-gutter-md justify-center">
				<farm v-for="farm in selectedFarms" :key="farm.pid" :account="activeAccount" :value="farm" />
				<div class="col-md-1" />
			</div>
		</div>
	</q-page>
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'
import { namespace } from 'vuex-class'
import Farm from '@/components/farms/Farm.vue'
import benis from '@/store/modules/benis'
import accounts from '@/store/modules/accounts'
import prices from '@/store/modules/prices'
import { FarmConfig } from '@/config/constants/types'
import TokensUtil from '@/utils/TokensUtil'
import { ethers } from 'ethers'
import BenisUtils from '@/utils/BenisUtils'
import { BN_ZERO } from '@/models/FarmData'
import { Benis } from '@artifacts/typechain'

const benisStore = namespace('benis')
const accountsStore = namespace('accounts')

@Component({
	components: {
		Farm,
	},
})
export default class FarmsPage extends Vue {
	@benisStore.Getter('farms')
	allFarms!: Array<FarmConfig>

	@accountsStore.State('activeAccount')
	activeAccount!: string

	@accountsStore.Getter('providerEthers')
	provider!: ethers.providers.JsonRpcProvider | null

	@benisStore.Getter('benisContract')
	benis!: Benis

	farmsSelected = 'active'

	userHasDepositsInEndedFarms = false

	wpawAddress: string = TokensUtil.getWPAWAddress()

	benisUtils = new BenisUtils()

	static ENV_NAME: string = process.env.VUE_APP_ENV_NAME || ''

	get selectedFarms(): Array<FarmConfig> {
		return this.farmsSelected === 'active' ? this.activeFarms : this.endedFarms
	}

	get activeFarms(): Array<FarmConfig> {
		return (
			this.allFarms
				// only keep farms not ended
				.filter((farm) => this.benisUtils.getFarmDurationLeft(farm.pid, Farm.ENV_NAME) !== 'Finished')
		)
	}

	get endedFarms(): Array<FarmConfig> {
		return (
			this.allFarms
				// only keep farms ended
				.filter((farm) => this.benisUtils.getFarmDurationLeft(farm.pid, Farm.ENV_NAME) === 'Finished')
		)
	}

	async mounted() {
		await accounts.initWalletProvider()
		await prices.loadPrices()
		await benis.initContract(this.provider)

		// find out if there are some user deposits in ended farms
		const userNeedsWithdrawal = await this.findAsyncSequential(this.endedFarms, async (farm) => {
			const deposits = await this.benisUtils.getStakedBalance(farm.pid, this.activeAccount, this.benis)
			return deposits.gt(BN_ZERO)
		})
		if (userNeedsWithdrawal) {
			this.userHasDepositsInEndedFarms = true
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private async findAsyncSequential<T>(array: T[], predicate: (t: T) => Promise<boolean>): Promise<T | undefined> {
		for (const t of array) {
			if (await predicate(t)) {
				return t
			}
		}
		return undefined
	}
}
</script>

<style lang="sass">
@import '@/styles/quasar.sass'

@media (max-width: $breakpoint-sm-min)
	h6.subtitle
		margin-top: $space-base !important
		margin-bottom: $space-base !important
</style>
