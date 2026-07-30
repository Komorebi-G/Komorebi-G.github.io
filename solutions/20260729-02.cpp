#include <bits/stdc++.h>
using namespace std;
#define int long long
#define double long double
const int N=2e4+7;
const int M=1<<20;
int a[N][22];
int f[M][22];
int mk[N];
int dp[M];

signed main()
{
	ios::sync_with_stdio(false);
	cin.tie(0);
//	cout<<pow(2,20);
	int n,m;
	cin>>n>>m;
	for(int i=1;i<=n;i++)
	{
		for(int j=1;j<=m;j++)
		{
			cin>>a[i][m-j+1];
		}
		for(int j=1;j<=m;j++)
		{
			char c;
			cin>>c;
			mk[i]<<=1;
			if(c=='A')
			{
				mk[i]|=1;
			}
		}
		//cout<<mk[i]<<endl;
		for(int j=1;j<=m;j++)
		{
			f[mk[i]][j]+=a[i][j];
		}
	}
	
	int mm=1<<m;
	for(int bit=0;bit<m;bit++)
	{
		for(int mask=0;mask<mm;mask++)
		{
			if(!(mask&(1<<bit)))
			{
				for(int i=1;i<=m;i++)
				{
					f[mask][i]+=f[mask|(1<<bit)][i];
				}
			}
		}
	}
//	for(int i=0;i<mm;i++)
//	{
//		for(int j=1;j<=m;j++)cout<<f[i][j]<<" \n"[j==m];
//	}
	
	for(int i=1;i<M;i++)dp[i]=1e18;
	for(int i=0;i<mm;i++)
	{
		for(int j=0;j<m;j++)
		{
			int mask=~(1ll<<j);
			if(i&(1<<j))
			{
				dp[i]=min(dp[i],dp[i&mask]+f[i&mask][j+1]);
				//cout<<i<<' '<<(i&mask)<<' '<<j<<endl;
			}
		}
	}
	cout<<dp[mm-1]<<endl;
}
