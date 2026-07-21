import { redirect } from "next/navigation";

/** /tds was a menu page linking to two destinations that are reachable from
 *  the client's month screen and the ⌘K palette. Send people to the register. */
export default function TdsPage() {
  redirect("/tds/register");
}
