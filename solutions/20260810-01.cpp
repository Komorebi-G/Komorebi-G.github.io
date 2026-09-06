#include <bits/stdc++.h>
using namespace std;
#define int long long
#define double long double
const int mod=1e9+7;
const int N=5e5+7;
int l[N];

int qpow(int a,int p)
{
	int ans=1;
	while(p)
	{
		if(p&1)ans=ans*a%mod;
		a=a*a%mod;
		p>>=1;
	}
	return ans;
}

int inv(int a){
	return qpow(a,mod-2);
}

signed main()
{
	//cout<<log10(0ull-1ull);
	int n;
	cin>>n;
	int sum=0;
	for(int i=1;i<=n;i++)
	{
		cin>>l[i];
		sum+=l[i];
	}
	int cnt=0;
	for(int i=1;i<=n;i++)
	{
		int p=l[i]*inv(sum)%mod;
		int tmpa=p*p%mod;
		int tmpb=(1+p+tmpa)%mod;
		tmpa=tmpa*p%mod;
		cnt+=tmpa*inv(tmpb)%mod;
		cnt%=mod;
	}
	cout<<inv(cnt);
}
