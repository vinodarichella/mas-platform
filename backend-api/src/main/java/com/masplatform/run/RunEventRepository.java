package com.masplatform.run;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RunEventRepository extends JpaRepository<RunEvent, UUID> {
    List<RunEvent> findByRunIdAndSequenceIdGreaterThanOrderBySequenceIdAsc(UUID runId, Long sequenceId);
    List<RunEvent> findByRunIdOrderBySequenceIdAsc(UUID runId);
}
