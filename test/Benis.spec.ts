import { ethers, upgrades } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { Benis } from "../artifacts/typechain/Benis";
import { WPAWToken } from "../artifacts/typechain/WPAWToken";
import { MockBEP20 } from "../artifacts/typechain/MockBEP20";
import { AnimalFactory } from "../artifacts/typechain/AnimalFactory";
import { AnimalPair } from "../artifacts/typechain/AnimalPair";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Signature } from "ethers";
import ReceiptsUtil from "./ReceiptsUtil";
import { increaseTo } from "./time";

chai.use(solidity);
const { expect } = chai;

describe('Benis', () => {
	let wpaw: WPAWToken;
	let wbnb: MockBEP20;
	let lpToken: AnimalPair;
	let benis: Benis;
	let rewardsStartTime: number;
	let owner: SignerWithAddress;
	let rewarder: SignerWithAddress;
	let user1: SignerWithAddress;

  beforeEach(async () => {
		const signers = await ethers.getSigners();
		[owner, rewarder, user1] = signers;

		// deploy wPAW contract
		const wPAWTokenFactory = await ethers.getContractFactory(
      "WPAWToken",
      signers[0]
    );
		wpaw = (await upgrades.deployProxy(wPAWTokenFactory)) as WPAWToken;
		await wpaw.deployed();
		expect(wpaw.address).to.properAddress;
		console.log(`wPAW deployed at "${wpaw.address}"`);

		// deploy fake WBNB contract
		const MockBEP20 = await ethers.getContractFactory("MockBEP20", signers[0]);
		const MINTED_WBNB = ethers.utils.parseEther("100");
		wbnb = (await MockBEP20.deploy("BNB", "BNB", MINTED_WBNB)) as MockBEP20;
		await wbnb.deployed();
		expect(wbnb.address).to.properAddress;
		console.log(`WBNB deployed at "${wbnb.address}"`);

		// deploy fake wPAW-WBNB pair
		const AnimalFactory = await ethers.getContractFactory("AnimalFactory", signers[0]);
		const apeFactory = (await AnimalFactory.deploy("0x0000000000000000000000000000000000000000")) as AnimalFactory; // no fees
		await apeFactory.deployed();
		expect(apeFactory.address).to.properAddress;
		console.log(`AnimalFactory deployed at "${apeFactory.address}"`);

		await apeFactory.createPair(wbnb.address, wpaw.address);
		const pairAddress = await apeFactory.getPair(wpaw.address, wbnb.address);
		lpToken = await ethers.getContractAt("AnimalPair", pairAddress, signers[0]) as AnimalPair;
		console.log(`AnimalPair wPAW-WBNB deployed at "${lpToken.address}"`);

		// deploy `Benis` contract
		const Benis = await ethers.getContractFactory("Benis", signers[0]);
		const rewardsPerSecond = ethers.utils.parseEther("1");
		rewardsStartTime = (await ethers.provider.getBlock('latest')).timestamp + 24 * 60 * 60;
		benis = await Benis.deploy(wpaw.address, rewardsPerSecond, rewardsStartTime) as Benis;
		await benis.deployed();
		expect(benis.address).to.properAddress;
		console.log(`Benis deployed at "${benis.address}"`);

		// mint some wPAW rewards
		const ONE_WEEK = BigNumber.from(7 * 24 * 60 * 60);
		const wPawRewards = rewardsPerSecond.mul(ONE_WEEK);
		console.debug(`Minting ${ethers.utils.formatEther(wPawRewards)} wPAW for rewards over 7 days`);
		const uuid = BigNumber.from(await owner.getTransactionCount());
		const sig: Signature = await ReceiptsUtil.createReceipt(owner, rewarder.address, wPawRewards, uuid, await owner.getChainId());
		const rewarder_wpaw = wpaw.connect(rewarder);
		await expect(rewarder_wpaw.mintWithReceipt(rewarder.address, wPawRewards, uuid, sig.v, sig.r, sig.s))
			.to.emit(wpaw, 'Transfer')
			.withArgs("0x0000000000000000000000000000000000000000", rewarder.address, wPawRewards);
		// send them to the rewards contract
		rewarder_wpaw.transfer(benis.address, wPawRewards);
	});

	it('Sends some wPAW-WBNB liquidity and stake it', async () => {
		// mint some wPAW first
		const wPawToMint = ethers.utils.parseEther("10000");
		const user1_wpaw = wpaw.connect(user1);
		const uuid = BigNumber.from(await user1.getTransactionCount());
		const sig: Signature = await ReceiptsUtil.createReceipt(owner, user1.address, wPawToMint, uuid, await owner.getChainId());
		await expect(user1_wpaw.mintWithReceipt(user1.address, wPawToMint, uuid, sig.v, sig.r, sig.s))
			.to.emit(wpaw, 'Transfer')
			.withArgs("0x0000000000000000000000000000000000000000", user1.address, wPawToMint);

		// mint some fake WBNB
		const wbnbToMint = ethers.utils.parseEther("0.7936");
		await wbnb.transfer(user1.address, wbnbToMint);
		const user1_wbnb = wbnb.connect(user1);
		expect(await user1_wbnb.balanceOf(user1.address)).to.equal(wbnbToMint);

		// provide liquidity
		let [wbnbReserve, wpawReserve, blockTimestampLast] = await lpToken.getReserves();
		console.debug(`Reserves: ${ethers.utils.formatEther(wpawReserve)} wPAW, ${ethers.utils.formatEther(wbnbReserve)} WBNB`);
		user1_wpaw.transfer(lpToken.address, wPawToMint);
		user1_wbnb.transfer(lpToken.address, wbnbToMint);
		const user1_lpToken = lpToken.connect(user1);
		expect(await user1_lpToken.totalSupply()).to.equal(BigNumber.from(0));
		await user1_lpToken.mint(user1.address);
		const liquidity: BigNumber = await lpToken.balanceOf(user1.address);
		expect(liquidity.gt(BigNumber.from(0)));
		console.debug(`Liquidity: ${ethers.utils.formatEther(liquidity)} LP tokens`);
		const wpawBalance = ethers.utils.formatEther(await wpaw.balanceOf(lpToken.address));
		const wbnbBalance = ethers.utils.formatEther(await wbnb.balanceOf(lpToken.address));
		console.debug(`Liquidity pool balances: ${wpawBalance} wPAW, ${wbnbBalance} WBNB`);
		[wbnbReserve, wpawReserve, blockTimestampLast] = await lpToken.getReserves();
		console.debug(`Reserves: ${ethers.utils.formatEther(wpawReserve)} wPAW, ${ethers.utils.formatEther(wbnbReserve)} WBNB`);

		// create farm pool
		await benis.add(1_000, lpToken.address, true);
		expect(await benis.poolLength()).to.equal(1);

		// stake liquidity
		const user1_benis = benis.connect(user1);
		await user1_lpToken.approve(user1_benis.address, liquidity);
		await user1_benis.deposit(0, liquidity);
		await increaseTo(rewardsStartTime);
		console.debug(`Current timestamp: ${(await ethers.provider.getBlock('latest')).timestamp}`);
		console.debug(`Rewards balance: ${ethers.utils.formatEther(await user1_benis.pendingWPAW(0, user1.address))} wPAW`);

		await increaseTo(rewardsStartTime + 7 * 24 * 60 * 60);
		console.debug(`Current timestamp: ${(await ethers.provider.getBlock('latest')).timestamp}`);
		console.debug(`Rewards balance: ${ethers.utils.formatEther(await user1_benis.pendingWPAW(0, user1.address))} wPAW`);

		// unstake liquidity
		await user1_benis.withdraw(0, liquidity);
		console.log(`Balance after unstaking: ${ethers.utils.formatEther(await wpaw.balanceOf(user1.address))} wPAW`);
	});

});
