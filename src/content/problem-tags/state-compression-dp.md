---
title: 状压 dp
summary: 用一个整数表示集合状态，在可控的指数复杂度内完成动态规划。
aliases:
  - 状压dp
  - 状态压缩 DP
  - bitmask dp
updatedAt: '2026-07-30'
order: 1
draft: false
---
## 子集枚举

```cpp
for (int T = S; T; T = (T - 1) & S)
    ...
```

## 容斥划分

按照二进制中 $1$ 的个数决定正负。
