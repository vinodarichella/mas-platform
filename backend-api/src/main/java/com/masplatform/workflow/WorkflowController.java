package com.masplatform.workflow;

import com.masplatform.workflow.dto.WorkflowDto;
import com.masplatform.workflow.dto.WorkflowRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/workflows")
@RequiredArgsConstructor
public class WorkflowController {

    private final WorkflowService workflowService;

    @GetMapping
    public List<WorkflowDto> list(@AuthenticationPrincipal UserDetails user) {
        return workflowService.list(UUID.fromString(user.getUsername()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkflowDto create(@AuthenticationPrincipal UserDetails user,
                              @Valid @RequestBody WorkflowRequest req) {
        return workflowService.create(UUID.fromString(user.getUsername()), req);
    }

    @GetMapping("/{id}")
    public WorkflowDto get(@PathVariable UUID id,
                           @AuthenticationPrincipal UserDetails user) {
        return workflowService.get(id, UUID.fromString(user.getUsername()));
    }

    @PutMapping("/{id}")
    public WorkflowDto update(@PathVariable UUID id,
                              @AuthenticationPrincipal UserDetails user,
                              @Valid @RequestBody WorkflowRequest req) {
        return workflowService.update(id, UUID.fromString(user.getUsername()), req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id,
                       @AuthenticationPrincipal UserDetails user) {
        workflowService.delete(id, UUID.fromString(user.getUsername()));
    }
}
