"use client";

// Lever: goal gradient. A shrinking distance and a moving dot make the help feel
// imminent. Donor shares live GPS; recipient watches each accepted donor move.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Navigation } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiDonationHeartbeat, isApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { haversineDistance, formatDistance, estimateDriveMinutes } from "@/lib/geo";
import type { MapMarker } from "@/components/map-view";
import { Card, Skeleton, LinkButton } from "@/components/ui";

const MapView = dynamic(() => import("@/components/map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-white/5" />,
});

interface LatLng {
  latitude: number;
  longitude: number;
}
interface DonorPin {
  id: string;
  latitude: number;
  longitude: number;
}

function MapContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const router = useRouter();
  const toast = useToast();
  const role = searchParams.get("role") === "donor" ? "donor" : "recipient";
  const isDonor = role === "donor";

  const [hospital, setHospital] = useState<{ latitude: number; longitude: number; name: string } | null>(null);
  const [donorCoords, setDonorCoords] = useState<LatLng | null>(null);
  const [donors, setDonors] = useState<DonorPin[]>([]);

  // Hospital location.
  useEffect(() => {
    let active = true;
    supabase
      .from("blood_requests")
      .select("latitude, longitude, hospital_name")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setHospital({ latitude: data.latitude, longitude: data.longitude, name: data.hospital_name });
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Donor: stream live location to the backend (throttled), watch own position.
  const lastPush = useRef(0);
  const stopped = useRef(false);
  useEffect(() => {
    if (!isDonor || typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setDonorCoords(c);
        const now = Date.now();
        if (stopped.current || now - lastPush.current < 30_000) return;
        lastPush.current = now;
        apiDonationHeartbeat(id, c.latitude, c.longitude).catch((e) => {
          if (isApiError(e) && (e.status === 400 || e.status === 404 || e.status === 409)) stopped.current = true;
        });
      },
      () => toast.error("Location is off", { description: "Turn it on so they can see you coming." }),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDonor, id]);

  // Recipient: subscribe to accepted donors' live positions.
  useEffect(() => {
    if (isDonor) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("request_responses")
        .select("donor_id, donor_lat, donor_lon")
        .eq("request_id", id)
        .eq("status", "accepted");
      if (!active) return;
      const pins = (data ?? [])
        .filter((r) => r.donor_lat != null && r.donor_lon != null)
        .map((r) => ({ id: r.donor_id as string, latitude: r.donor_lat as number, longitude: r.donor_lon as number }));
      setDonors(pins);
    };
    void load();
    const channel = supabase
      .channel(`live_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "request_responses", filter: `request_id=eq.${id}` }, () => void load())
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [isDonor, id]);

  const markers: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = [];
    if (hospital) out.push({ id: "hospital", lng: hospital.longitude, lat: hospital.latitude, color: "#D4183D", label: hospital.name });
    if (isDonor && donorCoords) out.push({ id: "me", lng: donorCoords.longitude, lat: donorCoords.latitude, color: "#14C083", label: "You" });
    for (const d of donors) out.push({ id: d.id, lng: d.longitude, lat: d.latitude, color: "#14C083", label: "Donor" });
    return out;
  }, [hospital, isDonor, donorCoords, donors]);

  const center = donorCoords
    ? { lat: donorCoords.latitude, lng: donorCoords.longitude }
    : hospital
      ? { lat: hospital.latitude, lng: hospital.longitude }
      : { lat: 31.5204, lng: 74.3587 };

  const distanceKm =
    isDonor && donorCoords && hospital
      ? haversineDistance(donorCoords.latitude, donorCoords.longitude, hospital.latitude, hospital.longitude)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => router.back()} className="inline-flex w-fit items-center gap-1.5 text-sm text-onyx-200 hover:text-bone-50">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="h-[60vh] overflow-hidden rounded-3xl border border-white/8">
        {hospital ? <MapView center={center} zoom={12} markers={markers} className="h-full w-full" /> : <Skeleton className="h-full w-full" />}
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-8">
          <div>
            <p className="text-2xl font-black tabular-nums text-crimson-500">{distanceKm != null ? formatDistance(distanceKm) : isDonor ? "..." : `${donors.length}`}</p>
            <p className="text-xs text-onyx-300">{isDonor ? "Distance" : donors.length === 1 ? "donor en route" : "donors en route"}</p>
          </div>
          {isDonor ? (
            <div>
              <p className="text-2xl font-black tabular-nums text-bone-50">{distanceKm != null ? `${estimateDriveMinutes(distanceKm)}m` : "..."}</p>
              <p className="text-xs text-onyx-300">Est. drive</p>
            </div>
          ) : null}
        </div>
        {isDonor && hospital ? (
          <LinkButton
            href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.latitude},${hospital.longitude}&travelmode=driving`}
          >
            <Navigation size={17} /> Open directions
          </LinkButton>
        ) : null}
      </Card>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex flex-col gap-4"><div className="h-40 w-full animate-pulse rounded-2xl bg-white/5" /></div>}>
      <MapContent />
    </Suspense>
  );
}
