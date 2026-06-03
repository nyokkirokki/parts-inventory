import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Category, PartDetail, PartStatus, PartWriteInput, Tag } from "@shared/types";
import { PartForm } from "../components/parts/PartForm";
import { Loading } from "../components/ui/Loading";
import { apiClient } from "../lib/api-client";

export function PartEditPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [part, setPart] = useState<PartDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [statuses, setStatuses] = useState<PartStatus[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiClient.getPart(id), apiClient.listCategories(), apiClient.listTags(), apiClient.listStatuses()])
      .then(([partData, categoryData, tagData, statusData]) => {
        setPart(partData);
        setCategories(categoryData);
        setTags(tagData);
        setStatuses(statusData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "データの読み込みに失敗しました。"));
  }, [id]);

  async function submit(input: PartWriteInput) {
    await apiClient.updatePart(id, input);
    navigate(`/parts/${id}`);
  }

  if (error) return <div className="p-4 text-app-danger">{error}</div>;
  if (!part) return <Loading />;
  return <PartForm initialPart={part} categories={categories} tags={tags} statuses={statuses} onSubmit={submit} />;
}
