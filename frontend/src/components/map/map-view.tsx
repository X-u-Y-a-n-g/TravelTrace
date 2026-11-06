import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, MAP_STYLE_URL } from "@/lib/constants";
import type { MapMarker, MapRoutes } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MapViewProps {
  markers?: MapMarker[];
  routes?: MapRoutes | null;
  className?: string;
  autoFit?: boolean;
  fitKey?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  interactive?: boolean;
  showControls?: boolean;
  onMarkerClick?: (marker: MapMarker) => void;
  onMapClick?: (coordinates: { lng: number; lat: number }) => void;
  selectedId?: string | null;
}

function emptyCollection() {
  return { type: "FeatureCollection", features: [] };
}

export function MapView({
  markers = [],
  routes,
  className,
  autoFit = true,
  fitKey,
  initialCenter = DEFAULT_MAP_CENTER,
  initialZoom = DEFAULT_MAP_ZOOM,
  interactive = true,
  showControls = true,
  onMarkerClick,
  onMapClick,
  selectedId,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, MapMarker>());
  const callbacksRef = useRef({ onMarkerClick, onMapClick });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const fittedRef = useRef<string | null>(null);

  callbacksRef.current = { onMarkerClick, onMapClick };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      interactive,
    });
    mapRef.current = map;

    if (showControls) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(
        new maplibregl.AttributionControl({ compact: true, customAttribution: "© OpenStreetMap" }),
        "bottom-right",
      );
    }

    map.on("load", () => {
      map.addSource("photos", {
        type: "geojson",
        data: emptyCollection() as never,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 46,
      });
      map.addSource("places", { type: "geojson", data: emptyCollection() as never });
      map.addSource("routes", { type: "geojson", data: emptyCollection() as never });

      map.addLayer({
        id: "route-lines",
        type: "line",
        source: "routes",
        paint: {
          "line-color": "#366150",
          "line-width": 2.5,
          "line-opacity": 0.7,
          "line-dasharray": [1.2, 2],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      map.addLayer({
        id: "photo-clusters",
        type: "circle",
        source: "photos",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#2c4e42",
          "circle-radius": ["step", ["get", "point_count"], 14, 10, 20, 50, 26],
          "circle-opacity": 0.92,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#f4eee1",
        },
      });

      map.addLayer({
        id: "photo-cluster-count",
        type: "symbol",
        source: "photos",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 11,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#f4eee1",
        },
      });

      map.addLayer({
        id: "photo-points",
        type: "circle",
        source: "photos",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#d4722a",
          "circle-radius": 5.5,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fbf8f2",
        },
      });

      map.addLayer({
        id: "place-points",
        type: "circle",
        source: "places",
        paint: {
          "circle-color": "#1f3d33",
          "circle-radius": 7,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#fbf8f2",
        },
      });

      map.on("click", "photo-clusters", async (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id as number | undefined;
        const source = map.getSource("photos") as maplibregl.GeoJSONSource | undefined;
        if (clusterId === undefined || !source) return;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const coordinates = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: coordinates, zoom: zoom + 0.2, duration: 500 });
      });

      const handleFeatureClick = (event: maplibregl.MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const id = feature?.properties?.id as string | undefined;
        if (!id) return;
        const marker = markersRef.current.get(id);
        if (!marker) return;
        const callback = callbacksRef.current.onMarkerClick;
        if (callback) {
          callback(marker);
          return;
        }
        const node = document.createElement("div");
        node.className = "space-y-0.5";
        const title = document.createElement("p");
        title.className = "font-semibold text-[13px] text-pine-900";
        title.textContent = marker.title;
        node.append(title);
        if (marker.subtitle) {
          const subtitle = document.createElement("p");
          subtitle.className = "text-[11px] text-muted-foreground";
          subtitle.textContent = marker.subtitle;
          node.append(subtitle);
        }
        new maplibregl.Popup({ closeButton: false, offset: 14, maxWidth: "240px" })
          .setLngLat([marker.longitude, marker.latitude])
          .setDOMContent(node)
          .addTo(map);
      };

      map.on("click", "photo-points", handleFeatureClick);
      map.on("click", "place-points", handleFeatureClick);

      map.on("click", (event) => {
        const callback = callbacksRef.current.onMapClick;
        if (callback) callback({ lng: event.lngLat.lng, lat: event.lngLat.lat });
      });

      for (const layer of ["photo-points", "place-points", "photo-clusters"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      setReady(true);
    });

    map.on("error", () => {
      // Keep the first style error visible as a graceful fallback message.
      if (!map.isStyleLoaded()) setFailed(true);
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current = new Map(markers.map((marker) => [marker.id, marker]));

    const photos = markers.filter((marker) => marker.kind === "photo");
    const places = markers.filter((marker) => marker.kind === "place");

    const photoCollection = {
      type: "FeatureCollection",
      features: photos.map((marker) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [marker.longitude, marker.latitude] },
        properties: { id: marker.id },
      })),
    };
    const placeCollection = {
      type: "FeatureCollection",
      features: places.map((marker) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [marker.longitude, marker.latitude] },
        properties: { id: marker.id },
      })),
    };

    (map.getSource("photos") as maplibregl.GeoJSONSource | undefined)?.setData(
      photoCollection as never,
    );
    (map.getSource("places") as maplibregl.GeoJSONSource | undefined)?.setData(
      placeCollection as never,
    );
  }, [markers, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("routes") as maplibregl.GeoJSONSource | undefined)?.setData(
      (routes ?? emptyCollection()) as never,
    );
  }, [routes, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !autoFit) return;
    const key = fitKey ?? (markers.length ? "markers" : null);
    if (!key || fittedRef.current === key) return;
    if (!markers.length && !routes?.features.length) return;

    const bounds = new maplibregl.LngLatBounds();
    markers.forEach((marker) => bounds.extend([marker.longitude, marker.latitude]));
    routes?.features.forEach((feature) =>
      feature.geometry.coordinates.forEach((coordinates) => bounds.extend(coordinates)),
    );
    if (bounds.isEmpty()) return;
    fittedRef.current = key;
    map.fitBounds(bounds, { padding: 56, maxZoom: 12, duration: 700 });
  }, [autoFit, fitKey, markers, ready, routes]);

  useEffect(() => {
    if (!selectedId) return;
    const marker = markers.find((item) => item.id === selectedId);
    const map = mapRef.current;
    if (marker && map) {
      map.easeTo({ center: [marker.longitude, marker.latitude], zoom: 13, duration: 600 });
    }
  }, [selectedId, markers]);

  return (
    <div className={cn("map-canvas relative min-h-[240px] overflow-hidden bg-sand-100", className)}>
      <div ref={containerRef} className="h-full w-full" />
      {failed && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl border border-border bg-card/95 px-4 py-3 text-xs text-muted-foreground shadow-soft">
          The map tiles could not be reached. Your data is safe — check your connection or map
          provider configuration.
        </div>
      )}
    </div>
  );
}
