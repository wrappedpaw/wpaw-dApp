import { WPAWToken } from '@artifacts/typechain'
import { BigNumber } from 'ethers'

type SwapToWPawRequest = {
	amount: BigNumber
	blockchainWallet: string
	receipt: string
	uuid: string
	contract: WPAWToken
}

export { SwapToWPawRequest }
