import { getModule, VuexModule, Module, Mutation, Action } from 'vuex-module-decorators'
import store from '@/store'
import Prices from '@/store/modules/prices'

@Module({
	namespaced: true,
	name: 'paw',
	store,
	dynamic: true,
})
class PAWModule extends VuexModule {
	private _pawAddress = ''
	private _pawPriceInUSD = 0
	private _initialized = false

	get pawAddress() {
		return this._pawAddress
	}

	get pawPriceInUSD() {
		return this._pawPriceInUSD
	}

	get pawAddressPicture() {
		return `https://pawnimal.paw.digital/api/v1/nano?address=${this.pawAddress}&svc=nanolooker`
	}

	@Mutation
	setPawAddress(address: string) {
		this._pawAddress = address
		localStorage.setItem('pawAddress', address)
	}

	@Mutation
	setPawPriceInUSD(price: number) {
		this._pawPriceInUSD = price
	}

	@Mutation
	setInitialized(initialized: boolean) {
		this._initialized = initialized
	}

	@Action
	async init() {
		const pawAddress = localStorage.getItem('pawAddress')
		if (pawAddress) {
			this.context.commit('setPawAddress', pawAddress)
		}
		if (!this._initialized) {
			await Prices.loadPrices()
			const wpawPrice = Prices.prices.get('wPAW')
			console.debug(`PAW price: $${wpawPrice}`)
			this.context.commit('setPawPriceInUSD', wpawPrice)
			this.context.commit('setInitialized', true)
		}
	}

	@Action
	setPawAccount(account: string) {
		this.context.commit('setPawAddress', account)
	}
}

export default getModule(PAWModule)
