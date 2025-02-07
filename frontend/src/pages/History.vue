<template>
	<q-page>
		<div class="q-pa-md row items-start">
			<div class="col-lg-3 col-md-3 col-sm-3 gt-xs">
				<Statistics />
			</div>
			<div class="col-lg-7 col-md-7 col-sm-9 col-xs-12">
				<div class="q-pa-lg">
					<div class="row q-gutter-md q-mb-sm">
						<!--
						<q-option-group
							type="radio"
							dense
							v-model="layout"
							inline
							:options="[
								{ label: 'Dense layout', value: 'dense' },
								{ label: 'Comfortable layout', value: 'comfortable' },
								{ label: 'Loose layout', value: 'loose' }
							]"
						/>
						-->

						<q-timeline :layout="layout" :side="side" color="primary">
							<q-timeline-entry heading>
								<q-btn to="/" icon="arrow_back" text-color="primary" flat style="margin-top: -10px" />
								History
							</q-timeline-entry>

							<q-timeline-entry
								v-for="(event, index) in history"
								:key="event.hash"
								:title="eventTitle(event)"
								:subtitle="event.timestamp | timestamp"
								:icon="eventIcon(event)"
								:color="eventColor(event)"
								:side="index % 2 === 0 ? 'left' : 'right'"
							>
								<div v-if="event.type === 'deposit'">
									You made a deposit of {{ event.amount | bnToStringFilter }} PAW.<br />
									Transaction:
									<a :href="event.link" class="hash" target="_blank">{{ event.hash | hash_trimmed }}</a>
								</div>
								<div v-if="event.type === 'withdrawal'">
									You made a withdrawal of {{ event.amount | bnToStringFilter }} PAW.<br />
									Transaction:
									<a :href="event.link" class="hash" target="_blank">{{ event.hash | hash_trimmed }}</a>
								</div>
								<div v-if="event.type === 'swap-to-wpaw'">
									<p v-if="event.consumed == true">
										You made a swap of {{ event.amount | bnToStringFilter }} PAW to wPAW.
									</p>
									<div v-if="event.consumed == false">
										<p>
											You asked for a swap of {{ event.amount | bnToStringFilter }} PAW to wPAW, but either you did not
											claim it or it did not work.
										</p>
										<q-btn @click="claim(event)" label="Claim" icon="restore" color="primary" text-color="secondary" />
									</div>
								</div>
								<div v-if="event.type === 'swap-to-paw'">
									You made a swap of {{ event.amount | bnToStringFilter }} wPAW to PAW.<br />
									Transaction:
									<a :href="event.link" class="hash" target="_blank">{{ event.hash | hash_trimmed }}</a>
								</div>
							</q-timeline-entry>
						</q-timeline>
					</div>
				</div>
			</div>
		</div>
	</q-page>
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'
import { namespace } from 'vuex-class'
import Statistics from '@/components/Statistics.vue'
import backend from '@/store/modules/backend'
import contracts from '@/store/modules/contracts'
import { SwapToWPawRequest } from '@/models/SwapToWPawRequest'
import { bnToStringFilter, pawPriceFilter, timestampFilter, hashTrimmedFilter } from '@/utils/filters'
import { BigNumber } from 'ethers'

const accountsStore = namespace('accounts')
const pawStore = namespace('paw')
const backendStore = namespace('backend')

@Component({
	components: {
		Statistics,
	},
	filters: {
		bnToStringFilter,
		pawPriceFilter,
		timestampFilter,
		hashTrimmedFilter,
	},
})
export default class HistoryPage extends Vue {
	@accountsStore.Getter('isUserConnected')
	isUserConnected!: boolean

	@accountsStore.State('activeAccount')
	activeAccount!: string

	@pawStore.Getter('pawAddress')
	pawAddress!: string

	@backendStore.Getter('deposits')
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	deposits!: Array<any>

	@backendStore.Getter('withdrawals')
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	withdrawals!: Array<any>

	@backendStore.Getter('swaps')
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	swaps!: Array<any>

	layout = 'dense'
	side = 'right'

	get history() {
		return (
			this.deposits
				.concat(this.withdrawals)
				.concat(this.swaps)
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				.sort((a: any, b: any) => (a.timestamp < b.timestamp ? 1 : -1))
		)
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	eventTitle(event: any) {
		switch (event.type) {
			case 'deposit':
				return 'Deposit'
			case 'withdrawal':
				return 'Withdrawal'
			case 'swap-to-wpaw':
				return 'Swap PAW -> wPAW'
			case 'swap-to-paw':
				return 'Swap wPAW -> PAW'
			default:
				return '??'
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	eventIcon(event: any) {
		switch (event.type) {
			case 'deposit':
				return 'file_download'
			case 'withdrawal':
				return 'file_upload'
			case 'swap-to-wpaw':
				return event.consumed ? 'done_all' : 'warning'
			case 'swap-to-paw':
				return 'done'
			default:
				return 'report'
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	eventColor(event: any) {
		switch (event.type) {
			case 'swap-to-wpaw':
				return event.consumed ? 'primary' : 'negative'
			default:
				return 'primary'
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async claim(event: any) {
		if (contracts.wpawContract) {
			console.debug(`Amount: ${event.amount}`)
			const swapRequest: SwapToWPawRequest = {
				amount: BigNumber.from(event.amount),
				blockchainWallet: this.activeAccount,
				receipt: event.receipt,
				uuid: event.uuid,
				contract: contracts.wpawContract,
			}
			await contracts.claim(swapRequest)
			await this.loadHistory()
		}
	}

	async loadHistory() {
		backend.getHistory({
			blockchainAddress: this.activeAccount,
			pawAddress: this.pawAddress,
		})
	}

	mounted() {
		if (!this.isUserConnected) {
			this.$router.push('/')
		}
		this.loadHistory()
	}
}
</script>

<style lang="sass" scoped>
@import '@/styles/quasar.sass'

.q-timeline
	a:link, a:visited
		color: $primary !important
</style>
