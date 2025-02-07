// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity 0.6.12;

import '@pancakeswap/pancake-swap-lib/contracts/math/SafeMath.sol';
import '@pancakeswap/pancake-swap-lib/contracts/token/BEP20/IBEP20.sol';
import '@pancakeswap/pancake-swap-lib/contracts/token/BEP20/SafeBEP20.sol';
import '@pancakeswap/pancake-swap-lib/contracts/access/Ownable.sol';

contract Benis is Ownable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        uint256 remainingWPAWReward; // WPAW Tokens that weren't distributed for user per pool.
        //
        // We do some fancy math here. Basically, any point in time, the amount of WPAW
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accWPAWPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws Staked tokens to a pool. Here's what happens:
        //   1. The pool's `accWPAWPerShare` (and `lastRewardTime`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }
    // Info of each pool.
    struct PoolInfo {
        IBEP20 stakingToken; // Contract address of staked token
        uint256 stakingTokenTotalAmount; //Total amount of deposited tokens
        uint256 accWPAWPerShare; // Accumulated wPAW per share, times 1e12. See below.
        uint32 lastRewardTime; // Last timestamp number that wPAW distribution occurs.
        uint16 allocPoint; // How many allocation points assigned to this pool. wPAW to distribute per second.
    }

    IBEP20 public immutable wpaw; // The wPAW TOKEN!!

    uint256 public wpawPerSecond; // wPAW tokens vested per second.

    PoolInfo[] public poolInfo; // Info of each pool.

    mapping(uint256 => mapping(address => UserInfo)) public userInfo; // Info of each user that stakes tokens.

    uint256 public totalAllocPoint = 0; // Total allocation points. Must be the sum of all allocation points in all pools.

    uint32 public immutable startTime; // The timestamp when wPAW farming starts.

    uint32 public endTime; // Time on which the reward calculation should end

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        IBEP20 _wpaw,
        uint256 _wpawPerSecond,
        uint32 _startTime
    ) public {
        wpaw = _wpaw;

        wpawPerSecond = _wpawPerSecond;
        startTime = _startTime;
        endTime = _startTime;
    }

    function changeEndTime(uint32 addSeconds) external onlyOwner {
        endTime += addSeconds;
    }

    // Changes wPAW token reward per second. Use this function to moderate the `lockup amount`.
    // Essentially this function changes the amount of the reward which is entitled to the
    // user for his token staking by the time the `endTime` is passed.
    // Good practice to update pools without messing up the contract
    function setWPAWPerSecond(uint256 _wpawPerSecond, bool _withUpdate) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        wpawPerSecond = _wpawPerSecond;
    }

    // How many pools are in the contract
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new staking token to the pool. Can only be called by the owner.
    // VERY IMPORTANT NOTICE
    // ----------- DO NOT add the same staking token more than once. Rewards will be messed up if you do. -------------
    // Good practice to update pools without messing up the contract
    function add(
        uint16 _allocPoint,
        IBEP20 _stakingToken,
        bool _withUpdate
    ) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardTime = block.timestamp > startTime ? block.timestamp : startTime;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                stakingToken: _stakingToken,
                stakingTokenTotalAmount: 0,
                allocPoint: _allocPoint,
                lastRewardTime: uint32(lastRewardTime),
                accWPAWPerShare: 0
            })
        );
    }

    // Update the given pool's wPAW allocation point. Can only be called by the owner.
    // Good practice to update pools without messing up the contract
    function set(
        uint256 _pid,
        uint16 _allocPoint,
        bool _withUpdate
    ) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    // Return reward multiplier over the given _from to _to time.
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        _from = _from > startTime ? _from : startTime;
        if (_from > endTime || _to < startTime) {
            return 0;
        }
        if (_to > endTime) {
            return endTime - _from;
        }
        return _to - _from;
    }

    // View function to see pending wPAW on frontend.
    function pendingWPAW(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accWPAWPerShare = pool.accWPAWPerShare;

        if (block.timestamp > pool.lastRewardTime && pool.stakingTokenTotalAmount != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardTime, block.timestamp);
            uint256 wpawReward = multiplier.mul(wpawPerSecond).mul(pool.allocPoint).div(totalAllocPoint);
            accWPAWPerShare = accWPAWPerShare.add(wpawReward.mul(1e12).div(pool.stakingTokenTotalAmount));
        }
        return user.amount.mul(accWPAWPerShare).div(1e12).sub(user.rewardDebt).add(user.remainingWPAWReward);
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.timestamp <= pool.lastRewardTime) {
            return;
        }

        if (pool.stakingTokenTotalAmount == 0) {
            pool.lastRewardTime = uint32(block.timestamp);
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardTime, block.timestamp);
        uint256 wpawReward = multiplier.mul(wpawPerSecond).mul(pool.allocPoint).div(totalAllocPoint);
        pool.accWPAWPerShare = pool.accWPAWPerShare.add(wpawReward.mul(1e12).div(pool.stakingTokenTotalAmount));
        pool.lastRewardTime = uint32(block.timestamp);
    }

    // Deposit staking tokens to Benis for wPAW rewards.
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accWPAWPerShare).div(1e12).sub(user.rewardDebt).add(user.remainingWPAWReward);
            user.remainingWPAWReward = safeRewardTransfer(msg.sender, pending);
        }
        pool.stakingToken.safeTransferFrom(address(msg.sender), address(this), _amount);
        user.amount = user.amount.add(_amount);
        pool.stakingTokenTotalAmount = pool.stakingTokenTotalAmount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accWPAWPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw staked tokens from Benis.
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, 'Benis: not enough LP');
        updatePool(_pid);
        uint256 pending =
            user.amount.mul(pool.accWPAWPerShare).div(1e12).sub(user.rewardDebt).add(user.remainingWPAWReward);
        user.remainingWPAWReward = safeRewardTransfer(msg.sender, pending);
        user.amount = user.amount.sub(_amount);
        pool.stakingTokenTotalAmount = pool.stakingTokenTotalAmount.sub(_amount);
        user.rewardDebt = user.amount.mul(pool.accWPAWPerShare).div(1e12);
        pool.stakingToken.safeTransfer(address(msg.sender), _amount);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 userAmount = user.amount;
        pool.stakingTokenTotalAmount = pool.stakingTokenTotalAmount.sub(userAmount);
        delete userInfo[_pid][msg.sender];
        pool.stakingToken.safeTransfer(address(msg.sender), userAmount);
        emit EmergencyWithdraw(msg.sender, _pid, userAmount);
    }

    // Safe wPAW transfer function. Just in case if the pool does not have enough wPAW token,
    // The function returns the amount which is owed to the user
    function safeRewardTransfer(address _to, uint256 _amount) internal returns (uint256) {
        uint256 wpawBalance = wpaw.balanceOf(address(this));
        if (wpawBalance == 0) {
            //save some gas fee
            return _amount;
        }
        if (_amount > wpawBalance) {
            //save some gas fee
            wpaw.safeTransfer(_to, wpawBalance);
            return _amount.sub(wpawBalance);
        }
        wpaw.safeTransfer(_to, _amount);
        return 0;
    }
}
