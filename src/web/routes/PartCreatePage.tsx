import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Category, PartDetail, PartStatus, PartWriteInput, Tag } from "@shared/types";
import { PartForm } from "../components/parts/PartForm";
import { Loading } from "../components/ui/Loading";
import { apiClient } from "../lib/api-client";

export function PartCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [statuses, setStatuses] = useState<PartStatus[]>([]);
  const [initialPart, setInitialPart] = useState<PartDetail | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const duplicateId = Number(searchParams.get("duplicate"));
    Promise.all([
      apiClient.listCategories(),
      apiClient.listTags(),
      apiClient.listStatuses(),
      duplicateId ? apiClient.getPart(duplicateId) : Promise.resolve(undefined),
    ]).then(([categoryData, tagData, statusData, duplicate]) => {
      setCategories(categoryData);
      setTags(tagData);
      setStatuses(statusData);
      if (duplicate) setInitialPart({ ...duplicate, id: 0, modelNumber: `${duplicate.modelNumber}-COPY`, stockQuantity: 0 });
    })
      .catch((err) => setError(err instanceof Error ? err.message : "データの読み込みに失敗しました。"))
      .finally(() => setIsLoading(false));
  }, [searchParams]);

  async function submit(input: PartWriteInput) {
    const created = await apiClient.createPart(input);
    navigate(`/parts/${created.id}`);
  }

  if (isLoading) return <Loading />;
  if (error) return <div className="p-4 text-app-danger">{error}</div>;
  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-950">部品登録</h1>
      </section>
      <PartForm categories={categories} tags={tags} statuses={statuses} initialPart={initialPart} onSubmit={submit} />
    </div>
  );
}
