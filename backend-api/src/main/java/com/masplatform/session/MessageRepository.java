package com.masplatform.session;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findBySessionIdOrderBySequenceIdAsc(UUID sessionId);

    @Query("SELECT m FROM Message m WHERE m.sessionId = :sessionId ORDER BY m.sequenceId DESC LIMIT :limit")
    List<Message> findLastN(UUID sessionId, int limit);

    @Query("SELECT COALESCE(MAX(m.sequenceId), 0) FROM Message m WHERE m.sessionId = :sessionId")
    Long maxSequenceId(UUID sessionId);
}
