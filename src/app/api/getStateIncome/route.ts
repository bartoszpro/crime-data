import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("state_income")
      .select("GeoFIPS, 2020")
      .eq("Description", "Per capita personal income (dollars) 2/");

    console.log("Query Data:", data);

    if (error) {
      console.error("Supabase query error:", error.message);
      return NextResponse.json(
        { error: "Supabase query failed", details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.warn("No state income data found");
      return NextResponse.json(
        { error: "No state income data found" },
        { status: 404 }
      );
    }

    console.log("State income data fetched successfully:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Unexpected error in API route:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
