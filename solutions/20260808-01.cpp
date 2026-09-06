#include <bits/stdc++.h>
using namespace std;
#define int long long
#define double long double
const int N=2e5+7;
int a[N]; 
int ans;

inline int get(int last,int now)
{
	//cout<<last<<' '<<now<<' ';
	int k=ans;
	while(k!=0)
	{
		int mask=63 - __builtin_clzll(k);
		mask=1ll<<mask;
		k=k^mask;
		if((now|k)<last)now|=mask;	
	}
	if(now<last)now=-1;
//	cout<<now<<endl;
	return now;
}

void solve()
{
	int n;
	cin>>n;
	ans=0; 
	for(int i=1;i<=n;i++)cin>>a[i];
	for(int i=30;i>=0;i--)
	{
		int last=0;
		int mask=(1<<i)-1;
		mask|=ans;
		mask=~mask; 
		//cout<<"i"<<' '<<bitset<10>(mask)<<endl;
		for(int j=1;j<=n;j++)
		{
			int now=a[j]&mask;
			now=get(last,now);
		//	cout<<i<<' '<<now<<endl; 
			if(now==-1)
			{
				ans=ans|(1<<i);
				break;
			}
			last=now;
		}
	}
	cout<<ans<<'\n';
}

signed main()
{
	int t;
	cin>>t;
	while(t--)
	{
		solve();
	}
}
