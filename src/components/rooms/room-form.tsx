"use client";

import { useRouter } from "next/navigation";
import { useEffect, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { createRoomAction } from "@/lib/actions/rooms";
import {
  MAX_CAPACITY,
  MAX_FOCUS_TAG_LENGTH,
  MAX_ROOM_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_CAPACITY,
  ROOM_VISIBILITIES,
  type RoomVisibility,
} from "@/lib/validation/room";

const VISIBILITY_COPY: Record<
  RoomVisibility,
  { title: string; blurb: string }
> = {
  public: {
    title: "Public",
    blurb: "Listed in the rooms directory — anyone signed in can join.",
  },
  private: {
    title: "Private",
    blurb: "Never listed. Members join only through your invite link.",
  },
};

export function RoomForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createRoomAction, {});

  const [visibility, setVisibility] = useState<RoomVisibility>("public");
  const [focusTag, setFocusTag] = useState("");

  useEffect(() => {
    if (state.ok && state.roomId) {
      router.replace(`/rooms/${state.roomId}`);
    }
  }, [state.ok, state.roomId, router]);

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.error && <Notice tone="danger">{state.error}</Notice>}

      <div>
        <Label htmlFor="title">Room title</Label>
        <Input
          id="title"
          name="title"
          placeholder="Deep work — frontend sprint"
          maxLength={MAX_TITLE_LENGTH}
          aria-invalid={Boolean(state.fieldErrors?.title)}
          required
        />
        <FieldError message={state.fieldErrors?.title?.[0]} />
      </div>

      <div>
        <Label htmlFor="focusTag">Focus tag</Label>
        <Input
          id="focusTag"
          name="focusTag"
          value={focusTag}
          onChange={(event) => setFocusTag(event.target.value)}
          placeholder="react, thesis writing, design system…"
          maxLength={MAX_FOCUS_TAG_LENGTH}
          aria-invalid={Boolean(state.fieldErrors?.focusTag)}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          One short tag that describes what the room is working on.
        </p>
        <FieldError message={state.fieldErrors?.focusTag?.[0]} />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="What are you working on? Pomodoro breaks at the top of the hour?"
          maxLength={MAX_ROOM_DESCRIPTION_LENGTH}
          aria-invalid={Boolean(state.fieldErrors?.description)}
        />
        <FieldError message={state.fieldErrors?.description?.[0]} />
      </div>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-foreground">
          Visibility
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROOM_VISIBILITIES.map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                visibility === value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                checked={visibility === value}
                onChange={() => setVisibility(value)}
                className="sr-only"
              />
              <span className="block text-sm font-semibold">
                {VISIBILITY_COPY[value].title}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {VISIBILITY_COPY[value].blurb}
              </span>
            </label>
          ))}
        </div>
        <FieldError message={state.fieldErrors?.visibility?.[0]} />
      </fieldset>

      <div className="max-w-40">
        <Label htmlFor="capacity">Seats (2–{MAX_CAPACITY})</Label>
        <Input
          id="capacity"
          name="capacity"
          type="number"
          inputMode="numeric"
          min={MIN_CAPACITY}
          max={MAX_CAPACITY}
          defaultValue={4}
          aria-invalid={Boolean(state.fieldErrors?.capacity)}
          required
        />
        <FieldError message={state.fieldErrors?.capacity?.[0]} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" loading={pending}>
          Create room
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/rooms")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
