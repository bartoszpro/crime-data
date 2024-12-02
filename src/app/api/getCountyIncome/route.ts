import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const geoFips = searchParams.get("geoFips");

    if (!geoFips) {
      console.error("Missing GeoFIPS parameter");
      return NextResponse.json(
        { error: "Missing required 'geoFips' parameter" },
        { status: 400 }
      );
    }

    console.log("GeoFIPS parameter received:", geoFips);

    const { data, error } = await supabase
      .from("county_income")
      .select("2020")
      .eq("GeoFIPS", geoFips)
      .eq("Description", "Per capita personal income (dollars) 2/")
      .single();

    console.log("Fetching county income data for GeoFIPS:", geoFips);

    if (error) {
      console.error("Supabase query error:", error.message);
      return NextResponse.json(
        { error: "Supabase query failed", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      console.warn("No data found for GeoFIPS:", geoFips);
      return NextResponse.json(
        { error: `No income data found for GeoFIPS: ${geoFips}` },
        { status: 404 }
      );
    }

    console.log("Query result:", data);

    return NextResponse.json(data);
  } catch (err) {
    console.error("Unexpected error in API route:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
