import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const AMOUNT = ethers.parseUnits("30", 18);

async function deployFixture() {
  const [deployer, buyer, seller, arbiter, stranger] = await ethers.getSigners();
  
  // 1. 部署你的代币（注意合约名是 jsbToken）
  const token = await ethers.deployContract("jsbToken");
  
  // 2. 给买家发 100 个代币（假设 deployer 是 owner）
  await token.mint(buyer.address, ethers.parseUnits("100", 18));
  
  // 3. 部署 Escrow，仲裁人是 arbiter
  const escrow = await ethers.deployContract("Escrow", [arbiter.address]);
  
  // 4. 计算 deadline（当前时间 + 1小时）
  const deadline = (await time.latest()) + 3600;
  
  return { token, escrow, deployer, buyer, seller, arbiter, stranger, deadline };
}

describe("Escrow", function () {
  it("createOrder 记录订单并发出事件", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    
    await expect(
      escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书")
    )
      .to.emit(escrow, "OrderCreated")
      .withArgs(0, buyer.address, seller.address, await token.getAddress(), AMOUNT, deadline);

    const order = await escrow.getOrder(0);
    expect(order.buyer).to.equal(buyer.address);
    expect(order.status).to.equal(0); // Created
    expect(await escrow.orderCount()).to.equal(1);
  });

  it("未 approve 时 deposit 失败", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    
    // 已根据你的 jsbToken 报错信息修改
    await expect(escrow.connect(buyer).deposit(0)).to.be.revertedWith("jsbToken: allowance insufficient");
  });

  it("approve 后 deposit 成功, 代币进入 Escrow, 状态变为 Paid", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    
    // 买家给 Escrow 授权
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);

    await expect(escrow.connect(buyer).deposit(0)).to.emit(escrow, "OrderPaid").withArgs(0);
    
    expect((await escrow.getOrder(0)).status).to.equal(1); // Paid
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(AMOUNT);
  });

  it("非买家调用 confirm 失败", async function () {
    const { token, escrow, buyer, seller, stranger, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).deposit(0);

    await expect(escrow.connect(stranger).confirm(0)).to.be.revertedWith("Escrow: caller is not the buyer");
  });

  it("confirm 后卖家收到代币, 状态变为 Completed", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).deposit(0);

    await expect(escrow.connect(buyer).confirm(0)).to.emit(escrow, "OrderCompleted").withArgs(0);
    
    expect((await escrow.getOrder(0)).status).to.equal(2); // Completed
    expect(await token.balanceOf(seller.address)).to.equal(AMOUNT);
  });

  it("deadline 之前 refund 失败, deadline 之后 refund 成功并退回买家", async function () {
    const { token, escrow, buyer, seller, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).deposit(0);

    // 没到期，应该失败
    await expect(escrow.connect(buyer).refund(0)).to.be.revertedWith("Escrow: deadline not reached");

    // 让时间前进 3601 秒（超过 3600 秒的 deadline）
    await time.increase(3601);
    
    await expect(escrow.connect(buyer).refund(0)).to.emit(escrow, "OrderRefunded").withArgs(0);
    expect((await escrow.getOrder(0)).status).to.equal(3); // Refunded
    expect(await token.balanceOf(buyer.address)).to.equal(ethers.parseUnits("100", 18));
  });

  it("非仲裁人调用 resolve 失败", async function () {
    const { token, escrow, buyer, seller, stranger, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).deposit(0);
    await escrow.connect(seller).dispute(0); // 卖家发起争议

    await expect(escrow.connect(stranger).resolve(0, false)).to.be.revertedWith("Escrow: caller is not the arbiter");
  });

  it("dispute 后仲裁人 resolve(false) 退款给买家, 状态变为 Refunded", async function () {
    const { token, escrow, buyer, seller, arbiter, deadline } = await loadFixture(deployFixture);
    await escrow.connect(buyer).createOrder(seller.address, await token.getAddress(), AMOUNT, deadline, "一本书");
    await token.connect(buyer).approve(await escrow.getAddress(), AMOUNT);
    await escrow.connect(buyer).deposit(0);
    await escrow.connect(seller).dispute(0);

    await expect(escrow.connect(arbiter).resolve(0, false)).to.emit(escrow, "OrderResolved").withArgs(0, false);
    expect((await escrow.getOrder(0)).status).to.equal(3); // Refunded
    expect(await token.balanceOf(buyer.address)).to.equal(ethers.parseUnits("100", 18));
  });
});