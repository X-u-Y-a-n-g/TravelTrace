import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { useI18n } from "@/i18n";
import { MAP_STYLE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  className,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const start: [number, number] =
      longitude !== null && latitude !== null ? [longitude, latitude] : [12, 30];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: start,
      zoom: latitude !== null ? 13 : 1.5,
      attributionControl: false,
      dragRotate: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const placeMarker = (lng: number, lat: number) => {
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        const element = document.createElement("div");
        element.className = "size-5 rounded-full border-[3px] border-white bg-ember-500 shadow-lg";
        markerRef.current = new maplibregl.Marker({ element, draggable: true })
          .setLngLat([lng, lat])
          .addTo(map);
        markerRef.current.on("dragend", () => {
          const position = markerRef.current?.getLngLat();
          if (position) onChangeRef.current(position.lat, position.lng);
        });
      }
    };

    if (latitude !== null && longitude !== null) placeMarker(longitude, latitude);

    map.on("click", (event) => {
      const { lng, lat } = event.lngLat;
      placeMarker(lng, lat);
      onChangeRef.current(lat, lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || latitude === null || longitude === null) return;
    const current = markerRef.current?.getLngLat();
    if (current && Math.abs(current.lat - latitude) < 1e-9 && Math.abs(current.lng - longitude) < 1e-9) {
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLngLat([longitude, latitude]);
    }
    map.easeTo({ center: [longitude, latitude], duration: 400 });
  }, [latitude, longitude]);

  return (
    <div
      className={cn(
        "map-canvas relative h-56 overflow-hidden rounded-2xl border border-border bg-sand-100",
        className,
      )}
    >
      <div ref={containerRef} className="h-full w-full" />
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-lg bg-card/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
        {t("photo.mapHint")}
      </span>
    </div>
  );
}
