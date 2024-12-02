"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { getGeoData } from "../utilities/geoData";
import Tooltip from "./Tooltip";

const Map = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const [currentStateId, setCurrentStateId] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [stateIncomeData, setStateIncomeData] = useState<
    Record<string, number>
  >({});

  const { statesData, countiesData } = getGeoData();

  const fetchCountyIncome = async (geoFips: string) => {
    try {
      const response = await fetch(`/api/getCountyIncome?geoFips=${geoFips}`);
      const data = await response.json();

      if (response.ok && data && data["2020"]) {
        return data["2020"];
      } else if (data.error) {
        console.error(`API Error for GeoFIPS ${geoFips}:`, data.error);
        return null;
      } else {
        console.warn(`No data found for GeoFIPS ${geoFips}`);
        return null;
      }
    } catch (error) {
      console.error(
        `Failed to fetch county income data for GeoFIPS ${geoFips}:`,
        error
      );
      return null;
    }
  };

  useEffect(() => {
    const fetchStateIncome = async () => {
      try {
        const response = await fetch(`/api/getStateIncome`);
        const data = await response.json();

        console.log("Raw Data from API:", data);

        if (response.ok && Array.isArray(data) && data.length > 0) {
          const incomeMap: Record<string, number> = {};
          data.forEach((item) => {
            const geoFIPS = item.GeoFIPS.toString();
            incomeMap[geoFIPS] = item["2020"];
          });

          console.log("Populated State Income Data:", incomeMap);
          setStateIncomeData(incomeMap);
        } else {
          console.error(
            "Error fetching state income data:",
            data.error || data
          );
        }
      } catch (error) {
        console.error("Failed to fetch state income data:", error);
      }
    };

    fetchStateIncome();
  }, []);

  useEffect(() => {
    if (Object.keys(stateIncomeData).length > 0) {
      console.log("State Income Data Updated:", stateIncomeData);

      const width = 1280;
      const height = 800;

      const svg = d3
        .select(svgRef.current)
        .attr("width", width)
        .attr("height", height);

      const g = d3.select(gRef.current);
      const projection = d3.geoIdentity().fitSize([width, height], statesData);
      const path = d3.geoPath(projection);

      const drawStates = () => {
        g.selectAll(".state")
          .data(statesData.features)
          .join("path")
          .attr("class", "state")
          .attr("d", path)
          .attr("fill", (d) => {
            const stateId = d.id.toString();
            const income = stateIncomeData[stateId];

            console.log(`Checking State ID: ${stateId}`);
            if (income) {
              console.log(
                `Match Found! State ID: ${stateId}, Income: ${income}`
              );
            } else {
              console.warn(`No income data found for State ID: ${stateId}`);
            }

            return income
              ? d3.interpolateBlues(
                  income / Math.max(...Object.values(stateIncomeData))
                )
              : "#d3d3d3";
          })
          .attr("stroke", "#000")
          .attr("stroke-width", 0.3)
          .style("cursor", "pointer")
          .on("click", (event, d) => {
            const stateId = parseInt(d.id).toString();
            setCurrentStateId(stateId);
            zoomToState(d, path);
            drawCounties(stateId);
          })
          .on("mouseover", (event, d) => {
            const [x, y] = d3.pointer(event, svgRef.current);
            const stateName = d.properties.name;
            const stateId = parseInt(d.id).toString();
            const income = stateIncomeData[stateId];

            setTooltipContent(
              income
                ? `${stateName}: $${income.toLocaleString()} per capita income (2020)`
                : `${stateName}: Income data not available`
            );
            setTooltipPosition({ x: x + 15, y: y + 15 });
          })
          .on("mousemove", (event) => {
            const [x, y] = d3.pointer(event, svgRef.current);
            setTooltipPosition({ x: x + 15, y: y + 15 });
          })
          .on("mouseout", () => {
            setTooltipContent(null);
          });
      };

      const drawCounties = async (stateId: string) => {
        g.selectAll(".county").remove();

        const stateCounties = countiesData.features.filter((county) =>
          county.id.startsWith(stateId)
        );

        const incomeData: Record<string, number> = {};

        await Promise.all(
          stateCounties.map(async (county) => {
            const income = await fetchCountyIncome(county.id);
            incomeData[county.id] = income;
          })
        );

        const incomes = Object.values(incomeData).filter((d) => d !== null);
        const colorScale = d3
          .scaleSequential(d3.interpolateBlues)
          .domain([Math.min(...incomes), Math.max(...incomes)]);

        g.selectAll(".county")
          .data(stateCounties)
          .join("path")
          .attr("class", "county")
          .attr("d", path)
          .attr("fill", (d) =>
            incomeData[d.id] ? colorScale(incomeData[d.id]) : "#d3d3d3"
          )
          .attr("stroke", "#000")
          .attr("stroke-width", 0.1)
          .on("mouseover", (event, d) => {
            const [x, y] = d3.pointer(event, svgRef.current);
            const countyName = d.properties.name;
            const income = incomeData[d.id];

            setTooltipContent(
              income
                ? `${countyName}: $${income.toLocaleString()} per capita income (2020)`
                : `${countyName}: Income data not available`
            );
            setTooltipPosition({ x: x + 15, y: y + 15 });
          })
          .on("mousemove", (event) => {
            const [x, y] = d3.pointer(event, svgRef.current);
            setTooltipPosition({ x: x + 15, y: y + 15 });
          })
          .on("mouseout", () => {
            setTooltipContent(null);
          });
      };

      const resetZoom = () => {
        setCurrentStateId(null);
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
        g.selectAll(".county").remove();
        drawStates();
      };

      const zoom = d3
        .zoom()
        .filter((event) => {
          if (event.type === "dblclick") {
            resetZoom();
            return false;
          }
          return event.type !== "wheel" && event.type !== "touchmove";
        })
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        });

      const zoomToState = (feature, path) => {
        try {
          const bounds = path.bounds(feature);
          const [[x0, y0], [x1, y1]] = bounds;
          const dx = x1 - x0;
          const dy = y1 - y0;
          const x = (x0 + x1) / 2;
          const y = (y0 + y1) / 2;

          const scale = Math.max(
            1,
            Math.min(8, 0.9 / Math.max(dx / width, dy / height))
          );

          const translate = [width / 2 - scale * x, height / 2 - scale * y];

          svg
            .transition()
            .duration(750)
            .call(
              zoom.transform,
              d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
        } catch (error) {
          console.error("Error in zoomToState:", error);
        }
      };

      svg.call(zoom);
      drawStates();

      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") resetZoom();
      });

      return () => {
        window.removeEventListener("keydown", (event) => {
          if (event.key === "Escape") resetZoom();
        });
      };
    }
  }, [stateIncomeData]);

  return (
    <div className='relative'>
      <svg ref={svgRef} className='border border-black'>
        <g ref={gRef}></g>
      </svg>
      {tooltipContent && (
        <Tooltip
          content={tooltipContent}
          x={tooltipPosition.x}
          y={tooltipPosition.y}
        />
      )}
    </div>
  );
};

export default Map;
