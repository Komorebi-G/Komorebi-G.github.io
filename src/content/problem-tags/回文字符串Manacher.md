---
title: 回文字符串Manacher
summary: 可以得到一个字符串每个位置的最大回文半径，O(n)复杂度。
aliases: []
updatedAt: '2026-08-01'
order: 4
draft: false
---
## 作用

可以得到一个字符串每个位置的最大回文半径，复杂度为 $O(n)$。

## 大致思路

维护端点最靠右的回文串 `center` 和 `right`。当前处理 $i$，$i$ 关于 `center` 的对称点 $j$ 的回文半径是已知的，回文的信息也可以搬过来。

## 板子

```cpp
vector<int> manacher(const string& s) {
    string t;
    t.reserve(2 * s.size() + 1);
    for (char c : s) {
        t.push_back('#');
        t.push_back(c);
    }
    t.push_back('#');
    int m = t.size();
    vector<int> p(m);

    int center = 0;
    int right = 0; // 当前回文右端点的后一位

    for (int i = 0; i < m; i++) {
        if (i < right) {
            int mirror = 2 * center - i;
            p[i] = min(p[mirror], right - i);
        } else {
            p[i] = 1;
        }

        while (i - p[i] >= 0 &&
               i + p[i] < m &&
               t[i - p[i]] == t[i + p[i]]) {
            p[i]++;
        }

        if (i + p[i] > right) {
            center = i;
            right = i + p[i];
        }
    }

    return p;
}
```
