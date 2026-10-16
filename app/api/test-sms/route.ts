import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
export async function POST() {
  const session=await auth();if(!session.userId)return NextResponse.json({error:"Unauthorized"},{status:401});
  const token=await session.getToken({template:"convex"});if(!token)return NextResponse.json({error:"Authentication unavailable"},{status:401});
  const client=new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);client.setAuth(token);
  try{return NextResponse.json(await client.mutation(api.automation.requestTest,{kind:"test"}));}
  catch{return NextResponse.json({error:"Test could not be queued. Check operator activation, SMS permission, and the test limit."},{status:409});}
}
