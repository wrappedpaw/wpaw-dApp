import tokens from '../tokens'
import { FarmConfig } from '../types'

const farms: FarmConfig[] = [
	{
		pid: 0,
		lpSymbol: 'wPAW-WETH',
		lpAddresses: {
			dev: '',
			staging: '',
			production: '0xb556feD3B348634a9A010374C406824Ae93F0CF8',
		},
		token: tokens.wpaw,
		quoteToken: tokens.weth,
		endTime: {
			dev: 0,
			staging: 0,
			production: 1648306800,
		},
	},
]

export default farms
