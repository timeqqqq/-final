# 第30组 Escrow 托管交易前端

本项目完成《区块链技术与应用》大作业路线 B，基于 Scaffold-ETH 2 实现订单创建、付款、确认收货、争议和仲裁。

## 运行方式

需要 Node.js ≥ 20.18.3、Yarn 3.2.3 和 MetaMask。在 WSL 中运行：

```bash
cd ~/blockchain-course/my-first-dapp
yarn install
yarn start
```

打开 http://localhost:3000/escrow。已有测试网合约，无需运行本地链或重新部署。

MetaMask 添加 POTOS Testnet：链 ID `60600`，RPC `https://rpc-testnet.potos.hk`，原生币 `POT`，区块浏览器 https://scan-testnet.potos.hk。

买家需准备 JSB 代币和支付 gas 的 POT。买家创建订单并付款，卖家可以发起争议，仲裁人处理争议；只有买家可以确认收货。付款会先确认 `approve`，再确认 `deposit`，需要两次钱包操作。

## 环境变量

运行现有路线 B 页面无需设置私钥或必填环境变量，交易由 MetaMask 签名。可选配置写入 `packages/nextjs/.env.local`：

```dotenv
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=你的WalletConnect项目ID
```

仅使用 MetaMask 扩展时可使用项目现有配置。POTOS RPC 配置位于 `packages/nextjs/scaffold.config.ts`；`NEXT_PUBLIC_ALCHEMY_API_KEY` 是框架可选项，不用于替换 POTOS RPC。

## 合约地址

| 项目 | POTOS Testnet 地址 |
| --- | --- |
| Escrow | `0x20F8A8EE2826a0AA7f66dd8c69a16aE9F8177476` |
| jsbToken（18位精度） | `0x10FE1e3172b6888cDe129F803eCE6f1ADd9BEe60` |
| 仲裁人 | `0x8936c54cd5B5aE0F499d0A0D7033c5A1fC84215F` |

页面代码：`packages/nextjs/app/escrow/page.tsx`。ABI 和部署地址：`packages/nextjs/contracts/deployedContracts.ts`。

## 交易记录

下表除部署记录外，需补入本组实际验收交易；订单编号以链上实际 ID 为准。

| 操作 | 交易哈希 | 区块浏览器链接 | 发起账户 |
| --- | --- | --- | --- |
| 部署 Escrow | `0x571192ed1b5443f579ac30efc86722184cf4d7798273386b61d8e3a174371909` | [查看交易](https://scan-testnet.potos.hk/tx/0x571192ed1b5443f579ac30efc86722184cf4d7798273386b61d8e3a174371909) | 部署账户 |
| createOrder 订单0 | 待补 | 待补 | 买家 A |
| approve | 待补 | 待补 | 买家 A |
| deposit 订单0 | 待补 | 待补 | 买家 A |
| dispute 订单1 | 待补 | 待补 | 卖家 B |
| resolve 订单1 | 待补 | 待补 | 仲裁人 C |
| confirm 订单0 | 待补 | 待补 | 买家 A |

## 仓库与分工

仓库地址：待填写本组 GitHub 或 Gitee 地址，设为公开或给予助教只读权限。

鞠思博、刘柯良共同设计和实现 `page.tsx`；马鸣负责测试与截图。
