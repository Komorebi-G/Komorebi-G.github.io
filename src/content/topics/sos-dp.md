---
title: SOS dp
summary: 已知集合的价值，计算所有超集的价值之和。
group: 算法笔记
aliases: []
updatedAt: '2026-07-30'
order: 2
draft: false
---
## 就是超集和、子集和
已知集合的价值，计算所有超集的价值之和。
设dp[S][i]表示S，考虑前i位0可自由变化的价值和。
dp[S][i]=dp[S][i-1]+dp[S|(1<<bit-1)][i-1]，如果第i位是0
比如dp 0010 3，他就是dp 0110 2 + dp 0010 2

子集和同理，把1看作0

## 板子
```cpp
for(int k=0;k<m;k++)
  for(int s=0;s<(1<<m);s++)
      if(!(s&(1<<k-1)))
        dp[s]=dp[s]+dp[s|(1<<k-1)];
```
这里原本dp[s]是s的价值，通过维度空间压缩得到了超集和
