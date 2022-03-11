import { WPAWToken } from '@artifacts/typechain'
import { BigNumber } from 'ethers'

type SwapToPawRequest = {
	amount: BigNumber
	toPawAddress: string
	contract: WPAWToken
}

export { SwapToPawRequest }
