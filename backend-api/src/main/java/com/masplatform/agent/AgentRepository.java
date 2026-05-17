package com.masplatform.agent;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AgentRepository extends JpaRepository<Agent, UUID> {
    List<Agent> findByUserIdOrderByCreatedAtDesc(UUID userId);
    Optional<Agent> findByIdAndUserId(UUID id, UUID userId);
    boolean existsByNameAndUserId(String name, UUID userId);
}
