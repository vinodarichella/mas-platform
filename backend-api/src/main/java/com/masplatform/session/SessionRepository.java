package com.masplatform.session;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SessionRepository extends JpaRepository<Session, UUID> {
    List<Session> findByUserIdOrderByLastActiveAtDesc(UUID userId);
    Optional<Session> findByIdAndUserId(UUID id, UUID userId);
}
