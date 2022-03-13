<template>
	<q-layout view="hHh lpR fFf">
		<q-header elevated>
			<q-toolbar class="bg-toolbar text-white">
				<q-btn v-if="drawerEnabled" dense flat round icon="menu" @click="drawerOpened = !drawerOpened" />
				<a @click="home" class="gt-xs">
					<img :src="require(`@/assets/wpaw-logo-${expectedBlockchain.network}.svg`)" class="currency-logo" />
				</a>
				<q-toolbar-title @click="home">{{ appTitle }}</q-toolbar-title>
				<q-btn v-if="!isUserConnected" @click="connectWalletProvider" flat dense>Connect</q-btn>
				<q-chip v-if="isUserConnected && !isMainnet" square color="red" text-color="white" icon="warning" class="gt-xs">
					You're not on the mainnet but {{ chainName }}!
				</q-chip>
				<q-avatar v-if="pawAddress" class="gt-xs">
					<img @click="openPaw(pawAddress)" :src="pawAddressPicture" :alt="pawAddress" />
					<q-tooltip>{{ pawAddress }}</q-tooltip>
				</q-avatar>
				<q-btn
					v-if="isUserConnected"
					@click="openBlockchainAccount(activeAccount)"
					flat
					round
					dense
					class="gt-xs"
					:icon="blockchainAddressIcon"
				>
					<q-tooltip>{{ activeAccount }}</q-tooltip>
				</q-btn>
				<q-btn flat round dense icon="settings">
					<settings-menu />
				</q-btn>
			</q-toolbar>
		</q-header>
		<q-drawer
			v-if="drawerEnabled"
			v-model="drawerOpened"
			behavior="desktop"
			side="left"
			overlay
			elevated
			:width="230"
			:breakpoint="500"
		>
			<q-list>
				<q-item clickable v-ripple @click="depositPAW">
					<q-item-section avatar>
						<q-icon name="img:paw-deposit.svg" size="3em" />
					</q-item-section>
					<q-separator vertical inset />
					<q-item-section>Deposit PAW</q-item-section>
				</q-item>
				<q-item clickable v-ripple @click="withdrawPAW">
					<q-item-section avatar>
						<q-icon name="img:paw-withdraw.svg" size="3em" />
					</q-item-section>
					<q-separator vertical inset />
					<q-item-section>Withdraw PAW</q-item-section>
				</q-item>
				<q-item clickable v-ripple @click="swap">
					<q-item-section avatar>
						<q-icon name="img:wpaw-swap.svg" size="3em" />
					</q-item-section>
					<q-separator vertical inset />
					<q-item-section>Swap</q-item-section>
				</q-item>
				<q-item clickable v-ripple to="/farms">
					<q-item-section avatar>
						<q-icon name="img:wpaw-farming.svg" size="3em" />
					</q-item-section>
					<q-separator vertical inset />
					<q-item-section>Stake &amp; Farm</q-item-section>
				</q-item>
			</q-list>
		</q-drawer>
		<q-page-container>
			<q-banner v-if="!backendOnline || inError" inline-actions class="text-secondary text-center bg-primary">
				{{ errorMessage }}
				<br />
				<a v-if="errorLink !== ''" :href="errorLink">{{ errorLink }}</a>
			</q-banner>
			<router-view />
		</q-page-container>
	</q-layout>
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'
import { namespace } from 'vuex-class'
import { Screen } from 'quasar'
import router from '@/router'
import accounts from '@/store/modules/accounts'
import paw from '@/store/modules/paw'
import backend from '@/store/modules/backend'
import prices from '@/store/modules/prices'
import SettingsMenu from '@/components/SettingsMenu.vue'
import { blockchainAddressFilter } from '@/utils/filters'
import QRCode from 'qrcode'
import { openURL } from 'quasar'
import { Network, Networks, BSC_MAINNET, POLYGON_MAINNET, FANTOM_MAINNET } from '@/utils/Networks'

const accountsStore = namespace('accounts')
const pawStore = namespace('paw')
const backendStore = namespace('backend')
const contractsStore = namespace('contracts')

@Component({
	components: {
		SettingsMenu,
	},
	filters: {
		blockchainAddressFilter,
	},
})
export default class MainLayout extends Vue {
	@accountsStore.State('chainId')
	chainId!: number

	@accountsStore.State('chainName')
	chainName!: string

	@accountsStore.State('blockExplorerUrl')
	blockExplorerUrl!: string

	@accountsStore.Getter('isUserConnected')
	isUserConnected!: boolean

	@accountsStore.State('activeAccount')
	activeAccount!: string

	@pawStore.Getter('pawAddress')
	pawAddress!: string

	@pawStore.Getter('pawAddressPicture')
	pawAddressPicture!: string

	@backendStore.Getter('online')
	backendOnline!: boolean

	@backendStore.Getter('inError')
	inError!: boolean

	@backendStore.Getter('errorMessage')
	errorMessage!: string

	@backendStore.Getter('errorLink')
	errorLink!: string

	@contractsStore.Getter('wpawAddress')
	wpawAddress!: string

	appTitle: string = process.env.VUE_APP_TITLE || 'wPAW -- Broken Release!!!'
	appVersion: string = process.env.VUE_APP_VERSION || '0'

	pawWalletForTips = 'paw_1wpaw1mwe1ywc7dtknaqdbog5g3ah333acmq8qxo5anibjqe4fqz9x3xz6ky'
	pawWalletForTipsQRCode = ''

	drawerOpened = false

	static DEX_URL: string = process.env.VUE_APP_DEX_URL || ''

	get isMainnet() {
		return (
			this.chainId === BSC_MAINNET.chainIdNumber ||
			this.chainId === POLYGON_MAINNET.chainIdNumber ||
			this.chainId === FANTOM_MAINNET.chainIdNumber
		)
	}

	get drawerEnabled() {
		return Screen.lt.sm && this.isUserConnected
	}

	get blockchainAddressIcon() {
		return `img:${this.expectedBlockchain.network}-logo-only.svg`
	}

	get expectedBlockchain(): Network {
		return new Networks().getExpectedNetworkData()
	}

	home() {
		if (this.$route.path != '/') {
			router.push('/')
		}
	}

	depositPAW() {
		document.dispatchEvent(new CustomEvent('deposit-paw'))
		this.drawerOpened = false
	}

	withdrawPAW() {
		document.dispatchEvent(new CustomEvent('withdraw-paw'))
		this.drawerOpened = false
	}

	swap() {
		document.dispatchEvent(new CustomEvent('swap'))
		this.drawerOpened = false
	}

	async created() {
		await accounts.initWalletProvider()
		await paw.init()
		await backend.initBackend(this.pawAddress)
		await prices.loadPrices()
		try {
			const qrcode: string = await QRCode.toDataURL(this.pawWalletForTips, {
				scale: 6,
				color: {
					dark: '2A2A2E',
					light: 'FBDD11',
				},
			})
			this.pawWalletForTipsQRCode = `img:${qrcode}`
		} catch (err) {
			console.error(err)
		}
	}

	async unmounted() {
		await backend.closeStreamConnection()
	}

	async connectWalletProvider() {
		await accounts.connectWalletProvider()
	}

	openBlockchainAccount(address: string) {
		openURL(`${this.blockExplorerUrl}/address/${address}`)
	}

	openPaw(address: string) {
		openURL(`https://tracker.paw.digital/account/${address}`)
	}

	openGithub(version: string) {
		openURL(`https://github.com/wrappedpaw/wpaw-dApp/releases/tag/v${version}`)
	}
}
</script>

<style lang="sass">
@import '@/styles/quasar.sass'

.bg-toolbar
	background-color: $positive !important

.q-drawer
	background-color: $secondary
	.q-item
		color: $primary
	.q-separator
		background-color: darken($primary, 15%)
		margin-left: -10px
		margin-right: 10px

.bg-footer
	background-color: lighten($secondary, 20%) !important
	text-align: center
	font-size: 1em
	padding-top: 5px
	padding-bottom: 5px
.social a
	font-weight: normal
	&:link, &:visited
		margin-right: 5px

//.q-page
//	background-color: $positive

.btn-disconnect
	text-transform: none
	font-family: $monospaced-font
	margin-bottom: -5px

.danger
	background-color: $negative
	padding-bottom: 5px

@media (max-width: 900px)
	#donations
		max-width: 100% !important
		.column, .row
			display: block
	#settings
		max-width: 50% !important
@media (min-width: 900px)
	#donations
		max-width: 1000px
	#settings
		max-width: 400px !important

@media (min-width: $breakpoint-md-min)
	.q-page
		// background-image: url('../../public/blocklettuce.png')
		background-position: top right
		background-repeat: no-repeat
		background-attachment: fixed
		background-size: contain
</style>
