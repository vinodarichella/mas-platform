package com.masplatform.run;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface HitlRequestRepository extends JpaRepository<HitlRequest, UUID> {
    List<HitlRequest> findByRunIdAndStatusOrderByCreatedAtDesc(UUID runId, String status);
}
