<template>
	<div class="q-pa-md">
		<div v-if="choiceMade === ''" class="q-pa-md row items-start justify-center q-gutter-md">
			<q-card class="coming-from-card" flat>
				<q-card-section class="currency-logo">
					<img :src="require(`@/assets/wpaw-logo-${expectedBlockchain.network}.svg`)" width="128px" />
				</q-card-section>
				<q-card-section>
					<div class="title">I'm new to wPAW</div>
					<div class="subtitle">I have Paw and want to start learning DeFi with wPAW.</div>
				</q-card-section>
				<q-card-section class="text-center">
					<q-btn
						@click="
							choiceMade = 'PAW'
							step = 3
						"
						color="primary"
						text-color="black"
						label="Continue"
					/>
				</q-card-section>
			</q-card>
			<q-card class="coming-from-card" flat>
				<q-card-section class="currency-logo">
					<img :src="require('@/assets/paw-logo-big.png')" />
				</q-card-section>
				<q-card-section>
					<div class="title">I'm new to Paw</div>
					<div class="subtitle">I have wPAW and want to use the Paw network.</div>
				</q-card-section>
				<q-card-section class="text-center">
					<q-btn @click="choiceMade = 'wPAW'" color="primary" text-color="black" label="Continue" />
				</q-card-section>
			</q-card>
		</div>

		<q-banner v-if="choiceMade !== ''" inline-actions rounded class="bg-primary text-secondary text-center">
			<p>We need to verify your PAW address!</p>
			<p>This step is important as it ensures that you control the PAW wallet interacting with wPAW.</p>
		</q-banner>

		<q-stepper
			v-if="choiceMade !== ''"
			v-model="step"
			vertical
			:active-color="activeColor"
			:inactive-color="inactiveColor"
			done-color="positive"
			animated
		>
			<q-step :name="1" title="Setup a Paw Wallet" icon="settings" :done="step > 1" v-if="choiceMade === 'wPAW'">
				For the best user experience, we recommend using the Biota mobile wallet:
				<div class="row">
					<div class="col-sm-auto col-xs-12">
					</div>
					<div class="col-sm-auto col-xs-12 offset-sm-1">
						<a href="https://play.google.com/store/apps/details?id=co.pawdigital.wallet" target="_blank">
							<img :src="require('@/assets/kalium-playstore.svg')" class="kalium" />
						</a>
					</div>
				</div>
				<p>
					If you prefer to use a web wallet, then
					<a href="https://wallet.paw.digital/" target="_blank" style="color: $primary">Biome</a> web wallet is the
					next best choice.
				</p>
				<p>Click "Continue" button when you have created your wallet.</p>
				<q-stepper-navigation>
					<q-btn @click="step = 2" color="primary" text-color="black" label="Continue" />
				</q-stepper-navigation>
			</q-step>

			<q-step :name="2" title="Get some free Paw" icon="settings" :done="step > 2" v-if="choiceMade === 'wPAW'">
				<p>You need some PAW to do the bridge setup.</p>
				<!-- <div>
					Paw has multiple faucets giving some PAW for free, like:
					<ul>
						<li><a href="https://getbanano.cc" target="_blank">iMalFect's Banano Faucet</a></li>
						<li><a href="https://faucet.prussia.dev" target="_blank">Prussia's Banano Faucet</a></li>
					</ul>
				</div> -->
				<p>Click "Continue" button when you have at least 0.1 PAW in your wallet.</p>
				<q-stepper-navigation>
					<q-btn @click="step = 3" color="primary" text-color="black" label="Continue" />
					<q-btn @click="step = 1" :text-color="activeColor" label="Back" flat class="q-ml-sm" />
				</q-stepper-navigation>
			</q-step>

			<q-step :name="3" title="Paw Address" icon="settings" :done="step > 3">
				<q-form @submit="step = 4">
					<q-input
						v-model="pawAddress"
						label="Paw Address"
						class="paw-address"
						dense
						autofocus
						:rules="[
							(val) => !!val || 'Paw address is required',
							(val) => val.match(/^paw_[13][0-13-9a-km-uw-z]{59}$/) || 'Invalid Paw address',
							(val) => this.isNotBlacklisted(val) || 'Blacklisted address',
						]"
					/>
					<q-stepper-navigation>
						<q-btn type="submit" color="primary" text-color="black" label="Continue" />
						<q-btn
							@click="step = 2"
							:text-color="activeColor"
							label="Back"
							flat
							class="q-ml-sm"
							v-if="choiceMade === 'wPAW'"
						/>
					</q-stepper-navigation>
				</q-form>
			</q-step>

			<q-step :name="4" title="Claim your address" icon="create_new_folder" :done="step > 4">
				<p>
					Please verify that your Paw address is indeed <span class="paw-address">{{ pawAddress }}</span>
				</p>
				<p>
					This is important as we will <i>link</i> your Paw address with your {{ expectedBlockchain.chainName }} one.
				</p>
				<q-stepper-navigation>
					<q-btn @click="claimPawWallet" color="primary" text-color="secondary" label="Continue" />
					<q-btn @click="step = 3" :text-color="activeColor" label="Back" flat class="q-ml-sm" />
				</q-stepper-navigation>
			</q-step>

			<q-step :name="5" title="Make a Paw deposit" icon="add_comment">
				<div class="row">
					<div class="col-8 col-xs-12">
						<p>
							<strong>Within the next 5 minutes</strong>, you need to confirm your claim by sending a PAW deposit from
							this Paw wallet to this one
							<a class="paw-address" :href="pawWalletForDepositsLink">{{ pawWalletForDeposits }}</a>
						</p>
						<div v-if="$q.platform.is.desktop" class="row justify-start items-center q-gutter-md">
							<div class="col-2 text-right">
								<q-btn
									@click="copyPawAddressForDepositsToClipboard"
									color="primary"
									text-color="secondary"
									label="Copy Deposit Address"
								/>
								<br />
								or scan QRCode:
							</div>
							<div class="col">
								<q-icon :name="pawWalletForDepositsQRCode" size="200px" />
								<br />
							</div>
						</div>
						<p>
							Although any amount would be fine, let's be safe and transfer 0.1 PAW.
							<br />
							Don't worry this deposit will be available for withdrawal if you want so.
						</p>
					</div>
				</div>
				<q-stepper-navigation>
					<q-btn @click="checkPawDeposit" color="primary" text-color="secondary" label="Check Deposit" />
					<q-btn @click="step = 4" :text-color="activeColor" label="Back" flat class="q-ml-sm" />
				</q-stepper-navigation>
			</q-step>
		</q-stepper>
	</div>
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator'
import { namespace } from 'vuex-class'
import router from '@/router'
import accounts from '@/store/modules/accounts'
import paw from '@/store/modules/paw'
import backend from '@/store/modules/backend'
import { BigNumber } from 'ethers'
import QRCode from 'qrcode'
import { ClaimResponse } from '@/models/ClaimResponse'
import { copyToClipboard } from 'quasar'
import { Network, Networks } from '@/utils/Networks'
import { PawWalletsBlacklist, BlacklistRecord } from '@/utils/PawWalletsBlacklist'

const accountsStore = namespace('accounts')
const backendStore = namespace('backend')

@Component
export default class SetupPage extends Vue {
	public choiceMade = ''
	public pawAddress = ''
	public step = 1

	@accountsStore.Getter('isUserConnected')
	isUserConnected!: boolean

	@backendStore.Getter('pawDeposited')
	pawDeposited!: BigNumber

	@backendStore.Getter('pawWalletForDeposits')
	pawWalletForDeposits!: string

	@backendStore.Getter('pawWalletForDepositsLink')
	pawWalletForDepositsLink!: string

	pawWalletForDepositsQRCode = ''

	get expectedBlockchain(): Network {
		return new Networks().getExpectedNetworkData()
	}

	get activeColor(): string {
		if (this.$q.dark.isActive) {
			return 'primary'
		} else {
			return 'secondary'
		}
	}

	get inactiveColor(): string {
		return '#9e9e9e'
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async isNotBlacklisted(pawWallet: string): Promise<any> {
		const result: BlacklistRecord | undefined = await PawWalletsBlacklist.isBlacklisted(pawWallet)
		if (result !== undefined) {
			return 'Do not use an exchange or faucet address.'
		} else {
			return true
		}
	}

	async claimPawWallet() {
		const result: ClaimResponse = await backend.claimAddresses({
			pawAddress: this.pawAddress,
			blockchainAddress: accounts.activeAccount as string,
			provider: accounts.providerEthers,
		})
		switch (result) {
			case ClaimResponse.Ok:
				this.step = 5
				break
			case ClaimResponse.AlreadyDone:
				// skip step 5 and redirect to home if claim was previously done
				paw.setPawAccount(this.pawAddress)
				router.push('/')
				break
			default:
				console.log("Can't claim")
		}
	}

	async checkPawDeposit() {
		console.info(`Should check with the backend if a PAW deposit was made from "${this.pawAddress}"`)
		await backend.loadPawDeposited(this.pawAddress)
		while (!this.pawDeposited.gt(0)) {
			console.log('Waiting for deposit...')
			// eslint-disable-next-line no-await-in-loop
			await new Promise((resolve) => setTimeout(resolve, 5000))
		}
		console.log(`Found a balance of ${this.pawDeposited}`)
		paw.setPawAccount(this.pawAddress)
		router.push('/')
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
		paw.init()
		await backend.initBackend(this.pawAddress)
		if (!this.isUserConnected) {
			router.push('/')
		}
		this.pawAddress = paw.pawAddress
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
	}

	async unmounted() {
		await backend.closeStreamConnection()
	}
}
</script>

<style lang="sass">
@import '@/styles/quasar.sass'

.coming-from-card
	background-color: lighten($secondary, 5%)
	max-width: 400px
	padding: 20px
	.currency-logo
		padding-bottom: 0
		img
			width: 128px
	.title
		text-align: left
		font-weight: bold
		font-size: 2rem
	.subtitle
		color: darken(white, 20%)
		font-size: 1.3rem

.kalium
	background-color: $secondary
	padding: 10px
	border-radius: 5px

.q-stepper
	a:link, a:visited
		color: $primary

.q-stepper--dark
	background-color: lighten($secondary, 10%) !important
body.body--dark
	.q-field input
		color: white !important
	.q-field__label
		color: $primary !important

.q-field--dark:not(.q-field--highlighted) .q-field__label, .q-field--dark .q-field__marginal, .q-field--dark .q-field__bottom
	color: $primary
</style>
