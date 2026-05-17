package com.masplatform.run;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RunRepository extends JpaRepository<Run, UUID> {
    List<Run> findByUserIdOrderByStartedAtDesc(UUID userId);
    List<Run> findBySessionIdOrderByStartedAtDesc(UUID sessionId);
    Optional<Run> findByIdAndUserId(UUID id, UUID userId);
}
