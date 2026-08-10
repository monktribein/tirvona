import { Map } from "lucide-react";
import TirvonaMap from "./TirvonaMap";

type Props = {
  ashram: any;
  coordinates: [number, number] | null;
};

export function AshramLocationCard({ ashram, coordinates }: Props) {
  return (
    <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="inline-flex items-center gap-2 text-xs font-extrabold text-[#0B192C] dark:text-white">
          <Map className="text-[#0A4DA6]" size={16} /> Location
        </h4>
        {coordinates && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${coordinates[0]},${coordinates[1]}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-1.5 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 rounded-full text-[9px] font-bold hover:bg-[#0A4DA6]/15 transition-all inline-block cursor-pointer"
          >
            Get Directions
          </a>
        )}
      </div>

      {coordinates ? (
        <>
          <TirvonaMap
            height="260px"
            zoom={15}
            center={coordinates}
            ariaLabel={`Map showing ${ashram.name}`}
            markers={[
              {
                id: ashram._id || "ashram",
                latitude: coordinates[0],
                longitude: coordinates[1],
                title: ashram.name,
                subtitle: [ashram.address?.street, ashram.address?.city]
                  .filter(Boolean)
                  .join(", "),
              },
            ]}
          />
          <p className="text-[9px] text-gray-400 text-center">
            {ashram.address?.street}, {ashram.address?.city} —{" "}
            {ashram.address?.pincode}
          </p>
        </>
      ) : (
        <p className="text-[10px] text-gray-400 font-medium text-center py-6">
          No map location has been set for this stay yet.
        </p>
      )}
    </div>
  );
}
