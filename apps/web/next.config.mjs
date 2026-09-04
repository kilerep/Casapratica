const api=process.env.NEXT_PUBLIC_API_URL??"http://localhost:3001";
export default {async rewrites(){return [{source:"/api/:path*",destination:`${api}/api/:path*`}];}};
