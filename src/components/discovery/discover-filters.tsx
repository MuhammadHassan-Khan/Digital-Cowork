import { buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import {
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
} from "@/lib/validation/profile";

/** GET-form filters — works without client JavaScript (server-rendered). */
export function DiscoverFilters({ q, level }: { q: string; level: string }) {
  const hasFilters = q !== "" || level !== "";

  return (
    <form
      method="get"
      action="/discover"
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      role="search"
    >
      <div className="relative flex-1">
        <label htmlFor="q" className="sr-only">
          Search members
        </label>
        <Input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name, bio or skill…"
          className="pr-3"
        />
      </div>

      <div className="sm:w-48">
        <label htmlFor="level" className="sr-only">
          Experience level
        </label>
        <Select id="level" name="level" defaultValue={level}>
          <option value="">All levels</option>
          {EXPERIENCE_LEVELS.map((value) => (
            <option key={value} value={value}>
              {EXPERIENCE_LEVEL_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex gap-2">
        <button type="submit" className={buttonClasses("primary", "md")}>
          Search
        </button>
        {hasFilters && (
          <a href="/discover" className={buttonClasses("ghost", "md")}>
            Clear
          </a>
        )}
      </div>
    </form>
  );
}
