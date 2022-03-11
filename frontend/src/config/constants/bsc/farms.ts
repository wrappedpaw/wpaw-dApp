import tokens from '../tokens'
import { FarmConfig } from '../types'

const farms: FarmConfig[] = [
	{
		pid: 0,
		lpSymbol: 'wPAW',
		lpAddresses: {
			dev: '0xfF67D65454eed25dDe0cE9b6e78c6e1E7e1FD34C',
			staging: '0x9222D24274E912F4d5E889b460924C4fEFe97954',
			production: '0xfF67D65454eed25dDe0cE9b6e78c6e1E7e1FD34C',
		},
		token: tokens.wpaw,
		quoteToken: tokens.wpaw,
		endTime: {
			dev: 1622142747,
			staging: 1622323076,
			production: 1627743600,
		},
	},
	{
		pid: 1,
		lpSymbol: 'wPAW-BNB (AnimalSwap)',
		lpAddresses: {
			dev: '0x4A80A8FF323beA03f16647647B53C2d4B619a31F',
			staging: '0xD9061825D488Fb96C49CE94320c3b1d2CAF5aeA6',
			production: '0x6011c6BAe36F2a2457dC69Dc49068a1E8Ad832DD',
		},
		token: tokens.wpaw,
		quoteToken: tokens.bnb,
		endTime: {
			dev: 1622142747,
			staging: 1622323076,
			production: 1632582000,
		},
	},
	{
		pid: 2,
		lpSymbol: 'wPAW-BUSD (AnimalSwap)',
		lpAddresses: {
			dev: '0x006554C403C65E07837ec5a6059D318AD3F901a1',
			staging: '0x66E98B0271756f1DC960cbD84690C07A554f4bcc',
			production: '0x7898466CACf92dF4a4e77a3b4d0170960E43b896',
		},
		token: tokens.wpaw,
		quoteToken: tokens.busd,
		endTime: {
			dev: 1622142747,
			staging: 1622323076,
			production: 1632582000,
		},
	},
	{
		pid: 3,
		lpSymbol: 'wPAW-BUSD (PancakeSwap)',
		lpAddresses: {
			dev: '',
			staging: '',
			production: '0x351A295AfBAB020Bc7eedcB7fd5A823c01A95Fda',
		},
		token: tokens.wpaw,
		quoteToken: tokens.busd,
		endTime: {
			dev: 0,
			staging: 0,
			production: 1637420400,
		},
	},
]

export default farms
