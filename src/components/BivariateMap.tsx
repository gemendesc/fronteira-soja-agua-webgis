import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BIVARIATE_COLORS,
  BIVARIATE_LABELS,
  EIXO_Y_META,
  RECORTE_META,
  formatCompact,
  formatNumber,
} from "../bivariate";
import type { EixoYKey, MunicipioSummary, RecorteKey } from "../types";

interface Props {
  geometries: GeoJSON.FeatureCollection | null;
  municipalities: MunicipioSummary[];
  recorte: RecorteKey;
  eixoY: EixoYKey;
  selectedClass: string | null;
  selectedMunId: string | null;
  flyTarget: { lon: number; lat: number } | null;
  onSelectMunicipality: (cdMun: string) => void;
}

const DARK_BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "esri-dark-base": {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Esri, HERE, Garmin, OpenStreetMap · Dados oficiais: INPE, MDIC, IBGE, ANA",
    },
    "esri-dark-labels": {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: "basemap-dark",
      type: "raster",
      source: "esri-dark-base",
      minzoom: 0,
      maxzoom: 16,
    },
  ],
};

export const BivariateMap: React.FC<Props> = ({
  geometries,
  municipalities,
  recorte,
  eixoY,
  selectedClass,
  selectedMunId,
  flyTarget,
  onSelectMunicipality,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const onSelectRef = useRef(onSelectMunicipality);
  onSelectRef.current = onSelectMunicipality;

  const eixoMetaRef = useRef(EIXO_Y_META[eixoY]);
  eixoMetaRef.current = EIXO_Y_META[eixoY];

  // Inicializa MapLibre GL JS
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_BASEMAP_STYLE,
      bounds: RECORTE_META.todos.bounds,
      fitBoundsOptions: { padding: 36 },
      maxZoom: 12,
      minZoom: 3,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "geo-hover-popup",
      offset: 12,
    });
    popupRef.current = popup;

    map.on("load", () => {
      map.addSource("municipios-src", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "municipios-fill",
        type: "fill",
        source: "municipios-src",
        paint: {
          "fill-color": ["coalesce", ["get", "fill_color"], "#111827"],
          "fill-opacity": ["coalesce", ["get", "fill_opacity"], 0.82],
        },
      });

      map.addLayer({
        id: "municipios-outline",
        type: "line",
        source: "municipios-src",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "is_selected"], true],
            "#f8fafc",
            ["==", ["get", "biv_class"], "C3"],
            "rgba(255, 190, 215, 0.55)",
            "rgba(148, 163, 184, 0.18)",
          ],
          "line-width": [
            "case",
            ["==", ["get", "is_selected"], true],
            2.4,
            ["==", ["get", "biv_class"], "C3"],
            0.9,
            0.35,
          ],
        },
      });

      map.addLayer({
        id: "basemap-labels-top",
        type: "raster",
        source: "esri-dark-labels",
        paint: { "raster-opacity": 0.78 },
      });

      map.on("mousemove", "municipios-fill", (e) => {
        const feat = e.features?.[0];
        if (!feat || !feat.properties) return;
        const p = feat.properties;
        if (!p.in_filter) {
          map.getCanvas().style.cursor = "default";
          popup.remove();
          return;
        }
        map.getCanvas().style.cursor = "pointer";
        const yMeta = eixoMetaRef.current;
        const badgeColor = BIVARIATE_COLORS[p.biv_class] || "#334155";
        const bivDesc = BIVARIATE_LABELS[p.biv_class] || p.biv_class;

        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="tt-card">
              <div class="tt-head">
                <strong>${p.nm_mun} (${p.sigla_uf})</strong>
                <span class="tt-badge" style="background:${badgeColor}">${p.biv_class}</span>
              </div>
              <div class="tt-sub">${p.bioma_predominante}${p.fl_matopiba ? " · MATOPIBA" : ""}${
                p.fl_arco_desmatamento ? " · Arco Desmat." : ""
              }</div>
              <div class="tt-metrics">
                <div><span>Desmatamento período:</span> <strong>${formatNumber(Number(p.desmat_km2), 1)} km²</strong></div>
                <div><span>${yMeta.shortLabel}:</span> <strong>${formatCompact(Number(p.y_value), 1)} ${yMeta.unit}</strong></div>
                <div><span>Soja produzida (PAM):</span> <strong>${formatCompact(Number(p.pam_ton), 1)} t</strong></div>
                <div><span>Irrigação (ANA):</span> <strong>${formatNumber(Number(p.irrig_hm3), 1)} hm³</strong></div>
              </div>
              <div class="tt-foot">${bivDesc} · Clique p/ abrir série anual</div>
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseleave", "municipios-fill", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("click", "municipios-fill", (e) => {
        const feat = e.features?.[0];
        if (feat?.properties?.cd_mun && feat.properties.in_filter) {
          onSelectRef.current(String(feat.properties.cd_mun));
        }
      });

      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Mescla geometrias PostGIS com métricas dinâmicas da consulta atual
  useEffect(() => {
    if (!mapReady || !mapRef.current || !geometries) return;
    const src = mapRef.current.getSource("municipios-src") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const summaryByMun = new Map<string, MunicipioSummary>();
    for (const m of municipalities) {
      summaryByMun.set(m.cd_mun, m);
    }

    const mergedFeatures = geometries.features.map((feat: any) => {
      const cdMun = String(feat.properties?.cd_mun || feat.id);
      const metric = summaryByMun.get(cdMun);
      const inFilter = Boolean(metric);
      const bivClass = metric?.biv_class || "OUT";
      const matchesClass = !selectedClass || bivClass === selectedClass;
      const isSelected = selectedMunId === cdMun;

      return {
        ...feat,
        properties: {
          ...feat.properties,
          in_filter: inFilter,
          biv_class: bivClass,
          is_selected: isSelected,
          desmat_km2: metric?.desmat_km2 ?? 0,
          y_value: metric?.y_value ?? 0,
          pam_ton: metric?.pam_ton ?? 0,
          irrig_hm3: metric?.irrig_hm3 ?? 0,
          fill_color: inFilter ? BIVARIATE_COLORS[bivClass] || "#1e293b" : "#0f172a",
          fill_opacity: !inFilter
            ? 0.22
            : isSelected
            ? 0.98
            : matchesClass
            ? 0.86
            : 0.14,
        },
      };
    });

    src.setData({
      type: "FeatureCollection",
      features: mergedFeatures,
    });
  }, [mapReady, geometries, municipalities, selectedClass, selectedMunId]);

  // Ajusta enquadramento ao trocar recorte regional
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const bounds = RECORTE_META[recorte]?.bounds || RECORTE_META.todos.bounds;
    mapRef.current.fitBounds(bounds, { padding: 40, duration: 900 });
  }, [mapReady, recorte]);

  // Voa até município pesquisado/selecionado na lista
  useEffect(() => {
    if (!mapReady || !mapRef.current || !flyTarget) return;
    mapRef.current.flyTo({
      center: [flyTarget.lon, flyTarget.lat],
      zoom: Math.max(mapRef.current.getZoom(), 6.8),
      duration: 950,
    });
  }, [mapReady, flyTarget]);

  return <div ref={containerRef} className="map-canvas" />;
};
