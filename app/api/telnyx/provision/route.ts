import { NextResponse } from "next/server";
// Pilot numbers are selected and verified by operators in /dashboard/ops.
export async function POST(){return NextResponse.json({error:"Ask your RoofReply operator to assign and verify your number."},{status:403});}
