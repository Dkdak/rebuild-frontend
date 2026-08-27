import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../shared/context/AuthContext";
import { fetchMeasurements, type MeasurementListItem } from "../api/measurementApi";

// F-19 §3.2-a 목록 — 대시보드 관심목록 표·분석 중인 대상 섹션·리포트 근거 밴드가 같은 응답을 쓴다.
// 미시작(실측 레코드 없음)은 이 목록에 없다 — 관심목록과 buildingId로 매칭해 3분류를 만든다.
export const useMeasurementRows = () => {
    const { token } = useAuth();
    const [rows, setRows] = useState<MeasurementListItem[] | null>(null);

    const reload = useCallback(() => {
        if (!token && !import.meta.env.DEV) return;

        fetchMeasurements(token)
            .then(setRows)
            .catch(() => setRows([]));
    }, [token]);

    useEffect(() => {
        reload();
    }, [reload]);

    const byBuildingId = new Map((rows ?? []).map((row) => [row.buildingId, row]));

    return { rows, byBuildingId, reload };
};
