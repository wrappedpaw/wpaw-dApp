import { TokensList } from '../types'

const tokens: TokensList = {
	wpaw: {
		symbol: 'wPAW',
		address: {
			dev: '0x47833fF31C106920fA6a8620444255dD5AcB4793',
			staging: '0x9222D24274E912F4d5E889b460924C4fEFe97954',
			production: '0x47833fF31C106920fA6a8620444255dD5AcB4793',
		},
		decimals: 18,
		projectLink: 'https://bsc.paw.digital/',
	},
	bnb: {
		symbol: 'BNB',
		projectLink: 'https://www.binance.com/',
	},
	busd: {
		symbol: 'BUSD',
		address: {
			dev: '0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee',
			staging: '0xed24fc36d5ee211ea25a80239fb8c4cfd80f12ee',
			production: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
		},
		decimals: 18,
		projectLink: 'https://www.paxos.com/busd/',
	},
}

export default tokens
