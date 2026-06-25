"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isGuideAdmin } from "@/lib/guide-admin";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function saveGuideArticle(formData: FormData) {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !isGuideAdmin(user)) {
    throw new Error("Only the guide admin can manage articles.");
  }

  const id = getString(formData, "id");
  const title = getString(formData, "title");
  const slug = normalizeSlug(getString(formData, "slug") || title);
  const eyebrow = getString(formData, "eyebrow");
  const summary = getString(formData, "summary");
  const body = getString(formData, "body");
  const published = formData.get("published") === "on";

  if (!title || !slug || !summary || !body) {
    throw new Error("Title, slug, summary, and body are required.");
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Slug can only contain lowercase letters, numbers, and hyphens.");
  }

  const payload = {
    title,
    slug,
    eyebrow,
    summary,
    body,
    published,
    author_user_id: user?.id,
    updated_at: new Date().toISOString(),
  };

  const result = id
    ? await supabase.from("guide_articles").update(payload).eq("id", id)
    : await supabase.from("guide_articles").insert(payload);

  if (result.error) {
    throw new Error(result.error.message);
  }

  revalidatePath("/guides");
  revalidatePath(`/guides/${slug}`);
  revalidatePath("/guides/admin");
  redirect(`/guides/admin?edit=${slug}&saved=1`);
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}
