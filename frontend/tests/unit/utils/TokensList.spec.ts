import { expect } from 'chai'
import TokensList from '@/utils/TokensUtil'
import nock from 'nock'
import axios from 'axios'

describe('TokensUtil', () => {

	beforeEach(async () => {
		const tokenList = (await axios.get('https://unpkg.com/@sushiswap/default-token-list@23.16.0/build/sushiswap-default.tokenlist.json')).data
		nock('http://localhost:3000')
			.defaultReplyHeaders({
				'access-control-allow-origin': '*',
				'access-control-allow-credentials': 'true'
			})
			.get('/dex/tokens')
			.reply(200, tokenList)
	})

	it('finds wPAW address', async () => {
		const wpawAddress = TokensList.getWPAWAddress()
		expect(wpawAddress).to.not.be.undefined
	})

	it('finds wPAW token by address', async () => {
		const wpaw = await TokensList.getToken('0xe20b9e246db5a0d21bf9209e4858bc9a3ff7a034')
		expect(wpaw).to.not.be.undefined
		if (wpaw === undefined) {
			throw Error()
		}
		expect(wpaw.symbol).to.equal('wPAW')
	})

	it('finds wPAW token by symbol', async () => {
		const wpaw = await TokensList.getTokenBySymbol('wPAW')
		expect(wpaw).to.not.be.undefined
		if (wpaw === undefined) {
			throw Error()
		}
		expect(wpaw.symbol).to.equal('wPAW')
	})

	it('finds plenty of tokens', async () => {
		const tokens = await TokensList.getAllTokens('0x0', null)
		expect(tokens).to.not.be.empty
	})

	it('filters tokens', async () => {
		let tokens = await TokensList.filterTokens('wpaw', '0x0', null)
		expect(tokens).to.have.lengthOf(1)

		tokens = await TokensList.filterTokens('usdc', '0x0', null)
		expect(tokens).to.have.lengthOf(1)
	})

	it('sorts tokens by lexical order', async () => {
		const tokens = await TokensList.getAllTokens('0x0', null)
		expect(tokens[0].symbol.localeCompare(tokens[1].symbol)).to.equal(-1)
	})
})
