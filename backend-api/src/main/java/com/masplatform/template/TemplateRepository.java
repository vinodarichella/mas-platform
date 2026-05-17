package com.masplatform.template;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TemplateRepository extends JpaRepository<Template, UUID> {
    List<Template> findAllByOrderByCategoryAscNameAsc();
    List<Template> findByCategoryOrderByNameAsc(String category);
    boolean existsByIsBuiltinTrue();
}
