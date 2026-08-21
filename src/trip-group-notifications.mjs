const stable = value => JSON.stringify(value ?? null);
const unique = values => [...new Set(values)];

export function classifySnapshotChange(before = {}, after = {}) {
  const changes=[];
  if(before.name!==after.name)changes.push("TRIP_TITLE_CHANGED");
  if(before.startDate!==after.startDate||before.endDate!==after.endDate)changes.push("TRIP_DATES_CHANGED");

  const beforeHouses=new Set(before.houseIds||[]),afterHouses=new Set(after.houseIds||[]);
  if([...afterHouses].some(id=>!beforeHouses.has(id)))changes.push("ACTIVITY_ADDED");
  if([...beforeHouses].some(id=>!afterHouses.has(id)))changes.push("ACTIVITY_REMOVED");
  if([...afterHouses].some(id=>beforeHouses.has(id)&&(before.houseDates?.[id]!==after.houseDates?.[id]||before.houseTimes?.[id]!==after.houseTimes?.[id])))changes.push("ACTIVITY_UPDATED");

  const keyed = events => new Map((events||[]).map((event,index)=>[event.id||`index:${index}`,event]));
  const beforeEvents=keyed(before.events),afterEvents=keyed(after.events);
  if([...afterEvents.keys()].some(id=>!beforeEvents.has(id)))changes.push("ACTIVITY_ADDED");
  if([...beforeEvents.keys()].some(id=>!afterEvents.has(id)))changes.push("ACTIVITY_REMOVED");
  if([...afterEvents].some(([id,event])=>beforeEvents.has(id)&&stable(beforeEvents.get(id))!==stable(event)))changes.push("ACTIVITY_UPDATED");
  if(stable(before.coverImageData)!==stable(after.coverImageData))changes.push("SNAPSHOT_UPDATED");

  const changeTypes=unique(changes);
  if(!changeTypes.length)return null;
  let type;
  if(changeTypes.length>1)type="TRIP_GROUP_ACTIVITY_BUNDLE";
  else if(changeTypes[0]==="ACTIVITY_ADDED")type="TRIP_ACTIVITY_ADDED";
  else if(changeTypes[0]==="ACTIVITY_UPDATED")type="TRIP_ACTIVITY_UPDATED";
  else if(changeTypes[0]==="ACTIVITY_REMOVED")type="TRIP_ACTIVITY_REMOVED";
  else if(["TRIP_TITLE_CHANGED","TRIP_DATES_CHANGED"].includes(changeTypes[0]))type="TRIP_DETAILS_UPDATED";
  else type="TRIP_SNAPSHOT_UPDATED";
  return {type,metadata:{bundled:changeTypes.length>1,changeCount:changeTypes.length,changeTypes}};
}
