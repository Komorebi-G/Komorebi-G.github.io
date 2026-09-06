#include <bits/stdc++.h>
using namespace std;
#define int long long
#define double long double
const int N=307;
int a[N][N];
int pr[N][N];
int pre[N];
int n,m,k;

int solve(int len)
{
	
	int ans=1e18;
	deque<int> dq;
	dq.push_back(0);
	for(int i=1;i<=m;i++)
	{
		while(!dq.empty()&&pre[i]<=pre[dq.back()])dq.pop_back();
		while(!dq.empty()&&pre[i]-pre[dq.front()]>=k)
		{
			ans=min(ans,(i-dq.front())*len);
			dq.pop_front();
		}
		dq.push_back(i);
	}
	return ans;
}

void work()
{
	cin>>n>>m>>k;
	for(int i=1;i<=n;i++)
		for(int j=1;j<=m;j++)
			cin>>a[i][j];
	for(int i=1;i<=n;i++)
	{
		for(int j=1;j<=m;j++)
		{
			pr[i][j]=pr[i-1][j]+pr[i][j-1]-pr[i-1][j-1]+a[i][j];
		}
	}
	int ans=1e18;
	for(int i=1;i<=n;i++)
	{
		for(int j=i;j<=n;j++)
		{
			for(int k=1;k<=m;k++)
			{
				pre[k]=pr[j][k]-pr[i-1][k];
			}
//			if(j==i+1)
//			{
//				cout<<"i:"<<i<<endl;
//				for(int k=1;k<=m;k++)
//				{
//					cout<<pre[k]<<" \n"[k==m];
//				}
//			}
			ans=min(solve(j-i+1),ans); 
		}
	}
	if(ans==1e18)cout<<-1<<'\n';
	else cout<<ans<<'\n';
}

signed main()
{
	int t;
	cin>>t;
	while(t--)work(); 
}
